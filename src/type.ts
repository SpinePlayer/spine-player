import type {
  TimeKeeper,
  TrackEntry,
  Event as SpineEvent,
} from '@esotericsoftware/spine-webgl';
import type SpineWebGL from './SpineWebGL';
import type SpineCanvas from './SpineCanvas';
import type SpineManage from './SpineManage';
import type { ShaderType } from './utils/constant';

// 导出供外部使用
export type { TimeKeeper, TrackEntry, SpineEvent };
export type { ShaderType };
export type { default as SpineWebGL } from './SpineWebGL';
export type { default as SpineCanvas } from './SpineCanvas';
export type { default as SpineManage } from './SpineManage';

export type SpineInstance = SpineWebGL | SpineCanvas | SpineManage;

export type OnUpdateCallback = (time: TimeKeeper, drawCall?: number) => void;

/**
 * 滤镜配置
 * @export
 * @interface ISpineFilters
 */
export interface ISpineFilters {
  type?: ShaderType; // 滤镜类型，默认none
  params?: {
    blurSize?: number;
    grayscaleLight?: number;
    customFragmentShader?: string; // 自定义着色器片段代码
  };
}

/**
 * 背景配置
 * @export
 * @interface IBackground
 */
export interface IBackground {
  color?: string; // 背景颜色，默认透明
  cacheKey?: string; // 背景图片缓存key，默认空字符串，支持url或base64
  imageUrl?: string; // 背景图片，默认空字符串，支持url或base64
  fit?: 'contain' | 'cover' | 'fill' | 'none' | 'scale-down'; // 背景图片适应方式，默认cover
}

/**
 * spine播放器选项
 * @export
 * @interface ISpineOptions
 */
export interface ISpineOptions {
  type?: 'auto' | 'webgl' | 'canvas2d';
  background?: IBackground | string; // 背景配置，支持颜色或图片url
  triangleRendering?: boolean; // 是否开启三角形渲染--2d渲染时配置生效
  onUpdate?: OnUpdateCallback; // 动画帧回调，仅webgl模式下有drawCall
}

/**
 * spine播放器配置
 * @export
 * @interface ISpineConfig
 */
export interface ISpineConfig {
  loop?: boolean; // 是否循环播放，默认false
  debugMode?: boolean; // 是否调试模式，默认false
  animationName?: string; // 初始动画名称，不传默认播放第一个动画
  customScale?: number; // 缩放比例，默认1，范围0.1~1.5
  dynamicCalcBound?: boolean; // 是否动态计算边界，默认false
  premultipliedAlpha?: boolean; // 是否开启预乘alpha，默认false，只对webgl模式生效
  autoPlay?: boolean; // 是否自动播放，默认为true，加载完自定播放
  renderFirstScreen?: boolean; // 是否渲染首屏，默认false，autoPlay为false时生效
  cleanAssetsCache?: boolean; // 是否清除上一个资源缓存，默认false
  uniBlendMode?: boolean; // 是否开启统一的标准混合模式，开启后有助于减少drawcall，但会相应的牺牲部分效果（因素材而异并不绝对，如：阴影），默认关闭
  // 资源路径
  assets: {
    useKTX2?: boolean; // 是否使用ktx2纹理，默认false
    basePath?: string; // 资源基础路径，默认空字符串
    skel: string;
    atlas: string;
    fileAlias?: Record<string, string>; // 文件别名，用于加载资源时替换文件路径，如：{ 'texture.png': 'http://xxx/texture.png' }，注意：此处要么不写，要么一定要写全atlas里用到的所有图片，且正确，否则会加载报错
    textures?: Array<string | Record<string, string>>; // 需要额外加载的自定义纹理图片，可用于插槽图片替换，注意：纹理图的URL不会自动拼接basePath
  };
  // 回调函数--如需更多事件监听，请获取实例的animationState，并监听事件
  hooks?: {
    onBeforeLoad?: () => void;
    onLoaded?: (spineInstance?: SpineInstance) => void;
    onComplete?: (trackEntry?: TrackEntry) => void;
    onEnd?: (trackEntry?: TrackEntry) => void;
    onEvent?: (spineEvent?: SpineEvent, trackEntry?: TrackEntry) => void;
    onFirstDraw?: (spineInstance?: SpineInstance) => void;
  };
  filters?: ISpineFilters; // 滤镜配置
}

/**
 * 边界设置
 * @export
 * @interface IBound
 */
export interface IBound {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX?: number;
  anchorY?: number;
}

/**
 * spine播放管理器配置
 * @export
 * @interface ISpineMange
 */
export interface ISpineMangeOptions {
  background?: IBackground | string; // 背景配置，支持颜色或图片url
  onUpdate?: OnUpdateCallback; // 动画帧回调，仅webgl模式下有drawCall
}

/**
 * spine播放加载配置
 * @export
 * @interface ISpineMangeConfig
 */
export interface ISpineMangeConfig extends Omit<ISpineConfig, 'customScale'> {
  uuid: string; // spine动画的唯一ID
  bound?: IBound; // 自定义边界设置
  zIndex?: number; // 层级，默认0
}

/**
 * 多spine渲染项管理
 * @export
 * @interface IRenderItem
 */
export interface IRenderItem {
  uuid: string;
  skel: string; // 骨骼文件
  atlas: string; // 纹理文件
  debugMode?: boolean; // 是否调试模式，默认false
  isPaused: boolean; // 是否暂停播放
  isHidden: boolean; // 是否隐藏
  filters?: ISpineFilters; // 滤镜配置
  premultipliedAlpha?: boolean; // 是否开启预乘alpha，默认false，只对webgl模式生效
  zIndex?: number; // 层级，默认0
  followSlots?: Map<string, (arg1?: IBonePosition) => void>; // slot挂点跟随监听
}

/**
 * Vue组件Props
 */
export interface ISpineProps extends Omit<ISpineConfig, 'hooks'>, Omit<ISpineOptions, 'onUpdate'> {

}


export type IUpdateConfig = Pick<ISpineConfig, 'customScale' | 'premultipliedAlpha'>

/**
 * 骨骼坐标位置
 */
export type IBonePosition = {
  x?: number; // 骨骼x坐标，基于dom坐标系
  y?: number; // 骨骼y坐标，基于dom坐标系
  scaleX?: number; // 骨骼缩放x
  scaleY?: number; // 骨骼缩放y
  rotation?: number; // 骨骼旋转
  boundX?: number; // 边界x坐标，基于左下角坐标系
  boundY?: number; // 边界y坐标，基于左下角坐标系
  opacity?: number; // 插槽透明度
}
