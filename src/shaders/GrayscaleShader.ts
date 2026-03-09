import { Shader, ManagedWebGLRenderingContext } from '@esotericsoftware/spine-webgl';
import newTwoColoredVS from './newTwoColoredVS';

export default function grayscaleFilter(context: ManagedWebGLRenderingContext | WebGLRenderingContext, grayscaleValue: number = 1.0, ) {
  // 顶点着色器
  let vs = newTwoColoredVS;

  // 片段着色器 - 通过字符串拼接直接写入值
  let fs = `
    #ifdef GL_ES
        #define LOWP lowp
        precision mediump float;
    #else
        #define LOWP
    #endif
    varying LOWP vec4 v_light;
    varying LOWP vec4 v_dark;
    varying vec2 v_texCoords;
    uniform sampler2D u_texture;
    
    void main () {
        vec4 texColor = texture2D(u_texture, v_texCoords);
        
        // 保持原有的颜色计算逻辑
        gl_FragColor.a = texColor.a * v_light.a;
        vec3 baseColor = ((texColor.a - 1.0) * v_dark.a + 1.0 - texColor.rgb) * v_dark.rgb + texColor.rgb * v_light.rgb;
        
        // 计算灰度值
        float gray = dot(baseColor, vec3(0.299, 0.587, 0.114));
        
        // 直接使用拼接的值进行混合，将float转换为vec3
        vec3 finalColor = mix(baseColor, vec3(gray), vec3(${grayscaleValue}));
        
        gl_FragColor.rgb = finalColor;
    }
  `;

  return new Shader(context, vs, fs);
}
