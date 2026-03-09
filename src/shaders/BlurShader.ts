import { Shader, ManagedWebGLRenderingContext } from '@esotericsoftware/spine-webgl';
import defaultVS from './newTwoColoredVS';

/**
 * 计算高斯权重
 * @param sigma 标准差
 * @param kernelSize 核大小
 * @returns 权重数组
 */
function calculateGaussianWeights(sigma: number, kernelSize: number): number[] {
  const weights: number[] = [];
  const half = Math.floor(kernelSize / 2);
  let sum = 0;
  
  for (let i = 0; i < kernelSize; i++) {
    const x = i - half;
    const weight = Math.exp(-(x * x) / (2 * sigma * sigma));
    weights.push(weight);
    sum += weight;
  }
  
  // 归一化权重
  return weights.map(w => w / sum);
}

/**
 * 生成高斯模糊片段着色器
 * @param sigma 模糊强度（标准差）
 * @param kernelSize 采样核大小
 * @param texelWidth 纹理像素宽度
 * @param texelHeight 纹理像素高度
 * @returns 片段着色器代码
 */
function generateGaussianBlurShader(
  sigma: number,
  kernelSize: number,
  texelWidth: number,
  texelHeight: number
): string {
  const weights = calculateGaussianWeights(sigma, kernelSize);
  const half = Math.floor(kernelSize / 2);
  
  // 生成权重变量声明
  let weightDeclarations = '';
  for (let i = 0; i < kernelSize; i++) {
    weightDeclarations += `float weight${i} = ${weights[i].toFixed(6)};\n`;
  }
  
  // 生成偏移变量声明
  let offsetDeclarations = '';
  for (let i = 0; i < kernelSize; i++) {
    const offset = (i - half).toFixed(1);
    offsetDeclarations += `float offset${i} = ${offset};\n`;
  }
  
  // 生成水平模糊采样代码
  let horizontalSampling = '';
  for (let i = 0; i < kernelSize; i++) {
    horizontalSampling += `
    vec2 offsetH${i} = vec2(offset${i} * texelSize.x, 0.0);
    vec4 sampleColorH${i} = texture2D(u_texture, v_texCoords + offsetH${i});
    totalRGB += sampleColorH${i}.rgb * sampleColorH${i}.a * weight${i};
    totalAlpha += sampleColorH${i}.a * weight${i};`;
  }
  
  // 生成垂直模糊采样代码
  let verticalSampling = '';
  for (let i = 0; i < kernelSize; i++) {
    verticalSampling += `
    vec2 offsetV${i} = vec2(0.0, offset${i} * texelSize.y);
    vec4 sampleColorV${i} = texture2D(u_texture, v_texCoords + offsetV${i});
    finalRGB += sampleColorV${i}.rgb * sampleColorV${i}.a * weight${i};
    finalAlpha += sampleColorV${i}.a * weight${i};`;
  }
  
  return `#ifdef GL_ES
precision mediump float;
#endif

varying vec4 v_light;
varying vec4 v_dark;
varying vec2 v_texCoords;
uniform sampler2D u_texture;

void main() {
  vec2 texelSize = vec2(${texelWidth.toFixed(6)}, ${texelHeight.toFixed(6)});
  
  // 声明权重
  ${weightDeclarations}
  
  // 声明偏移
  ${offsetDeclarations}
  
  vec3 totalRGB = vec3(0.0);
  float totalAlpha = 0.0;
  
  // 水平方向模糊
  ${horizontalSampling}
  
  // 垂直方向模糊
  vec3 finalRGB = vec3(0.0);
  float finalAlpha = 0.0;
  ${verticalSampling}
  
  // 混合两个方向的结果
  vec3 blurredColor = (totalRGB + finalRGB) * 0.5;
  float blurredAlpha = (totalAlpha + finalAlpha) * 0.5;
  
  // 应用 Spine 的着色逻辑
  vec3 tintedRGB = ((1.0 - blurredAlpha) * v_dark.rgb * v_dark.a) + blurredColor * v_light.rgb;
  float finalAlphaResult = blurredAlpha * v_light.a;
  
  gl_FragColor = vec4(tintedRGB / max(blurredAlpha, 0.0001), finalAlphaResult);
}`;
}

/**
 * 创建高斯模糊滤镜
 * @param context WebGL 上下文
 * @param canvasWidth 画布宽度
 * @param canvasHeight 画布高度
 * @param blurSize 模糊强度 (0.1 - 10.0)
 * @returns 着色器实例
 */
export default function blurFilter(
  context: ManagedWebGLRenderingContext | WebGLRenderingContext,
  canvasWidth: number,
  canvasHeight: number,
  blurSize: number = 8.0
): Shader {
  // 限制模糊强度范围
  const sigma = Math.max(0.1, Math.min(10.0, blurSize));
  
  // 根据模糊强度动态调整核大小
  let kernelSize: number;
  if (sigma <= 1.0) {
    kernelSize = 7;
  } else if (sigma <= 3.0) {
    kernelSize = 11;
  } else if (sigma <= 5.0) {
    kernelSize = 15;
  } else {
    kernelSize = 21;
  }
  
  // 确保核大小为奇数
  if (kernelSize % 2 === 0) {
    kernelSize += 1;
  }
  
  const texelWidth = 1.0 / canvasWidth;
  const texelHeight = 1.0 / canvasHeight;
  
  const fragmentShader = generateGaussianBlurShader(
    sigma,
    kernelSize,
    texelWidth,
    texelHeight
  );
  
  return new Shader(context, defaultVS, fragmentShader);
}