import { Shader, ManagedWebGLRenderingContext } from '@esotericsoftware/spine-webgl';
import newTwoColoredVS from './newTwoColoredVS';

export default function customFilter(context: ManagedWebGLRenderingContext | WebGLRenderingContext, fs: string) {
  // 顶点着色器
  let vs = newTwoColoredVS;

  return new Shader(context, vs, fs);
}
