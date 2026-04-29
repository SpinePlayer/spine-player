import type {
  Slot,
  Skeleton,
  Animation,
  TextureAtlas,
  AssetManager,
  SceneRenderer,
  AnimationState,
  Event as SpineEvent,
  ManagedWebGLRenderingContext
} from '@esotericsoftware/spine-webgl';
import {
  Vector3,
  Physics,
  MixBlend,
  MixDirection,
  RegionAttachment,
} from '@esotericsoftware/spine-webgl';
import logger from './utils/logger';
import { checkExtension, parseValueToNumber } from './utils/tool';
import { KTX2Parser } from './ktx2/parseKTX2';
import { GLTextureASTC } from './ktx2/GLTextureASTC';
import { SPINE_VERSION, ShaderType } from './utils/constant';
import { grayscaleFilter, blurFilter, customFilter } from './shaders';
import type { ISpineConfig, ISpineFilters, IUpdateConfig, IBackground } from './type';

export default class SpineUtils {
  /**
   * 获取画布
   */
  static getCanvas(el: HTMLElement | HTMLCanvasElement) {
    if (el instanceof HTMLCanvasElement) {
      return el;
    } else {
      const canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      el.appendChild(canvas);
      return canvas;
    }
  }

  /**
   * 加载纹理
   */
  static loadTexture(textureUrl: string | Record<string, string>, assetManager: AssetManager, basePath?: string) {
    if (typeof textureUrl === 'string') {
      if (!assetManager.get(textureUrl)) {
        assetManager.loadTexture(textureUrl);
      }
    } else {
      // 如果是对象的话，需要处理key和value
      for (let key in textureUrl) {
        if (!assetManager.get(key)) {
          const path = textureUrl[key];
          assetManager.loadTexture(path, (path, texture) => {
            try {
              const newKey = basePath ? basePath + key : key;
              // @ts-ignore
              delete assetManager.cache.assets[path];
              // @ts-ignore
              assetManager.cache.assets[newKey] = texture;
              // @ts-ignore
              const refCount = assetManager.cache.assetsRefCount[path] || 0;
              // @ts-ignore
              delete assetManager.cache.assetsRefCount[path];
              // @ts-ignore
              assetManager.cache.assetsRefCount[newKey] = refCount;
            } catch (error) {
              logger.error('纹理资源加载失败', error);
            }
          });
        }
      }
    }
  }

  static async loadKTX2Texture(ktx2Path: string, context: ManagedWebGLRenderingContext) {
    const response = await fetch(ktx2Path);
    if (!response.ok) {
      throw new Error(`Failed to fetch KTX2: ${ktx2Path}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const parsedData = KTX2Parser.parseToASTCTextureData(arrayBuffer);
    return new GLTextureASTC(context, parsedData);
  }

  static async loadTextureByKTX2(atlasSrc: string, assetManager: AssetManager, context: ManagedWebGLRenderingContext, fileAlias?: Record<string, string>) {
    const atlas = assetManager.get(atlasSrc) as TextureAtlas;
    if (atlas && atlas.pages instanceof Array) {
      await Promise.all(atlas.pages.map(async (page) => {
        const index = atlasSrc.lastIndexOf("/");
        const parent = index >= 0 ? atlasSrc.substring(0, index + 1) : "";
        let originalPath = `${parent}${page.name}`;
        if (fileAlias && fileAlias[page.name]) {
          originalPath = fileAlias[page.name];
        }
        const ktx2Path = originalPath?.replace('.png', '.ktx2');
        try {
          // @ts-ignore
          if (!assetManager.cache.assetsLoaded[originalPath]) {
            // @ts-ignore
            assetManager.cache.assetsLoaded[originalPath] = SpineUtils.loadKTX2Texture(ktx2Path, context);
          }
          // @ts-ignore
          const texture = await assetManager.cache.assetsLoaded[originalPath];
          page.setTexture(texture);
          // @ts-ignore
          assetManager.cache.assets[originalPath] = texture;
          // @ts-ignore
          assetManager.cache.assetsRefCount[originalPath] = (assetManager.cache.assetsRefCount[originalPath] || 0) + 1;
        } catch (error) {
          logger.error(`ktx2纹理加载失败:${ktx2Path}`, error);
          logger.warning(`已降级为png纹理:${originalPath}`);
          // @ts-ignore 删除失败的缓存
          delete assetManager.cache.assetsLoaded[originalPath];
          const texture = await assetManager.loadTextureAsync(originalPath);
          page.setTexture(texture);
        }
      }));
    } else {
      logger.error('atlas文件获取失败');
    }
  }

  /**
   * 加载资源
   */
  static async loadAssets(config: ISpineConfig, assetManager: AssetManager, context?: ManagedWebGLRenderingContext) {
    const basePath = config.assets.basePath || '';
    const useKTX2 = config.assets.useKTX2 || false;
    const fileAlias = config.assets.fileAlias || void 0;
    const skelSrc = basePath + config.assets.skel;
    const atlasSrc = basePath + config.assets.atlas;
    const isBinary = checkExtension(skelSrc, '.skel');
    try {
      // berfore load
      if (config?.hooks?.onBeforeLoad) {
        config?.hooks?.onBeforeLoad();
      }
      // Load the skeleton file.
      if (!assetManager.get(skelSrc)) {
        if (isBinary) {
          assetManager.loadBinary(skelSrc);
        } else {
          assetManager.loadText(skelSrc);
        }
      }
      // Load the atlas and its pages.
      if (!assetManager.get(atlasSrc)) {
        if (useKTX2 && context && GLTextureASTC.isSupported(context.gl)) {
          await assetManager.loadTextureAtlasButNoTexturesAsync(atlasSrc);
          await SpineUtils.loadTextureByKTX2(atlasSrc, assetManager, context, fileAlias);
        } else {
          if (useKTX2) {
            logger.warning(`${!context ? 'canvas2d模式' : '当前浏览器'}不支持ktx2纹理，已降级为png纹理`);
          }
          assetManager.loadTextureAtlas(atlasSrc, void 0, void 0, fileAlias);
        }
      }
      // Load textures
      if (config.assets.textures) {
        config.assets.textures.forEach((textureUrl: string | Record<string, string>) => {
          SpineUtils.loadTexture(textureUrl, assetManager, basePath);
        });
      }
      // 等待资源全部加载完毕
      await assetManager.loadAll();
    } catch (error) {
      logger.error('资源加载失败', error);
    }
    return {
      isBinary,
      skelSrc,
      atlasSrc,
      skelData: assetManager.get(skelSrc),
      atlasData: assetManager.get(atlasSrc)
    }
  }

  /**
   * 添加动画事件监听
   */
  static addEventListeners(animationState: AnimationState, config: ISpineConfig) {
    animationState.addListener({
      event: (entry, event: SpineEvent) => {
        logger.info(`Event ${event.data.name} occurred on track`);
        if (config?.hooks?.onEvent) {
          config?.hooks?.onEvent(event, entry);
        }
      },
      complete: (entry) => {
        // logger.info(`Animation complete on track`, entry);
        // if (stop && !loop) {
        //   stop();
        // }
        if (config?.hooks?.onComplete) {
          config?.hooks?.onComplete(entry);
        }
      },
      end: (entry) => {
        // logger.info(`Animation end on track`, entry);
        if (config?.hooks?.onEnd) {
          config?.hooks?.onEnd(entry);
        }
      },
    });
  }

  /**
   * 计算动画的边界
   */
  static calculateAnimationViewport(skeleton: Skeleton, animation: Animation, dynamicCalcBound?: boolean) {
    // 设置初始状态
    skeleton.scaleX = 1;
    skeleton.scaleY = 1;
    skeleton.x = 0;
    skeleton.y = 0;
    skeleton.setToSetupPose();

    if (!dynamicCalcBound) {
      skeleton.updateWorldTransform(Physics.update);
      return skeleton.getBoundsRect();
    }

    let steps = 100, stepTime = animation.duration ? animation.duration / steps : 0, time = 0;
    let minX = 100000000, maxX = -100000000, minY = 100000000, maxY = -100000000;

    for (let i = 0; i < steps; i++, time += stepTime) {
      animation.apply(skeleton!, time, time, false, [], 1, MixBlend.setup, MixDirection.mixIn);
      skeleton.updateWorldTransform(Physics.update);
      const bounds = skeleton.getBoundsRect();

      if (!isNaN(bounds.x) && !isNaN(bounds.y) && !isNaN(bounds.width) && !isNaN(bounds.height)) {
        minX = Math.min(bounds.x, minX);
        minY = Math.min(bounds.y, minY);
        maxX = Math.max(bounds.x + bounds.width, maxX);
        maxY = Math.max(bounds.y + bounds.height, maxY);
      } else {
        logger.error("Animation bounds are invalid: " + animation.name);
      }
    }

    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    }
  }

  /**
   * 计算骨骼挂点在视图中的位置
   */
  static calcBonePosition(slot: Slot, renderer?: SceneRenderer, htmlCanvas?: HTMLCanvasElement) {
    if (!slot?.bone) return null;

    // 获取附件的初始旋转
    const bone = slot.bone;
    const attachment = slot.getAttachment();
    let attachmentRotation = 0;
    if (attachment instanceof RegionAttachment) {
      attachmentRotation = attachment.rotation || 0;
    }

    // 获取骨骼的世界变换信息
    const scaleX = bone.getWorldScaleX();
    const scaleY = bone.getWorldScaleY();
    const boneX = bone.worldX;
    const boneY = -bone.worldY;
    // 插槽透明度
    const opacity = slot.color?.a || 1;

    // 根据渲染器类型进行坐标转换
    let x: number, y: number, rotation: number, boundX: number, boundY: number;
    if (htmlCanvas && renderer) {
      // WebGL坐标转换
      const { clientWidth: cvsW, clientHeight: cvsH } = htmlCanvas;
      const screenCoords = renderer.camera.worldToScreen(
        new Vector3(boneX, boneY, 0),
        cvsW,
        cvsH
      );
      x = screenCoords.x;
      y = screenCoords.y;
      boundX = x;
      boundY = cvsH - y;
      rotation = -bone.getWorldRotationX() - attachmentRotation;
      return { x, y, scaleX, scaleY, rotation, boundX, boundY, opacity };
    }
    // Canvas2D坐标转换
    const dpr = window.devicePixelRatio || 1;
    x = boneX / dpr;
    y = -boneY / dpr;
    rotation = bone.getWorldRotationX() - attachmentRotation;
    return { x, y, scaleX, scaleY, rotation, opacity };
  }

  /**
   * 验证配置
   */
  static validateConfig(config: IUpdateConfig) {
    if (typeof config.customScale === 'number' && (config.customScale < 0.1 || config.customScale > 1.5)) {
      logger.warning(`customScale 范围为0.1~1.5，当前值为${config.customScale}，已重置为1.0`);
      config.customScale = 1;
    }
  }

  /**
   * 检查spine版本
   */
  static checkVersion(version: string | null) {
    if (!version) return;
    const [expectedMajor, expectedMinor] = SPINE_VERSION.split('.').map(Number);
    const [actualMajor, actualMinor] = version.split('.').map(Number);

    // 比较主版本号和次版本号，忽略补丁版本号
    if (expectedMajor !== actualMajor || expectedMinor !== actualMinor) {
      logger.warning(`Spine版本不匹配`, `请使用【${SPINE_VERSION}.x】版本，当前Spine版本为【${version}】`);
    }
  }

  static ShaderType = ShaderType;

  static canUseShader(type: ShaderType | undefined, params?: ISpineFilters['params']) {
    if (!type) return false;
    if (type === ShaderType.NONE) return false;
    if (type === ShaderType.CUSTOM && !params?.customFragmentShader) {
      return false;
    }
    if (!Object.values(ShaderType).includes(type)) {
      logger.warning(`ShaderType ${type} 不合法`);
      return false;
    }
    return true;
  }

  /**
   * shader滤镜
   */
  static setShader(type: ShaderType, context: ManagedWebGLRenderingContext, canvas: HTMLCanvasElement, params?: ISpineFilters['params']) {
    if (type === ShaderType.GRAYSCALE) {
      return grayscaleFilter(context, params?.grayscaleLight);
    } else if (type === ShaderType.BLUR) {
      return blurFilter(context, canvas.width, canvas.height, params?.blurSize);
    } else if (type === ShaderType.CUSTOM && params?.customFragmentShader) {
      return customFilter(context, params?.customFragmentShader);
    }
    return null;
  }

  /**
   * 更换插槽纹理图
   */
  static hackTextureBySlotName(skeleton: Skeleton, assetManager: AssetManager, textureName: string, slotName: string, persistent?: boolean) {
    if (!skeleton) return;
    const texture = assetManager.get(textureName);
    if (!texture) {
      logger.warning(`纹理图片【${textureName}】不存在`);
      return;
    }
    const slot = skeleton.findSlot(slotName);
    if (!slot) {
      logger.warning(`插槽【${slotName}】不存在`);
      return;
    }
    const attachment = slot.getAttachment() as any;
    const oldRegion = attachment?.region;
    const textureRegion = {
      texture,
      u: 0,
      v: 0,
      u2: 1,
      v2: 1,
      degrees: 0,
      offsetX: 0,
      offsetY: 0,
      // degrees: oldRegion?.degrees || 0,
      // offsetX: oldRegion?.offsetX || 0,
      // offsetY: oldRegion?.offsetY || 0,
      width: texture.getImage().width || oldRegion?.width,
      height: texture.getImage().height || oldRegion?.height,
      originalWidth: texture.getImage().width || oldRegion?.originalWidth,
      originalHeight: texture.getImage().height || oldRegion?.originalHeight,
    };
    if (!persistent) {
      // 创建新的附件
      const newAttachment = attachment.copy();
      newAttachment.region = textureRegion;
      newAttachment.updateRegion();
      slot.setAttachment(newAttachment);
    } else {
      // 直接修改原附件
      attachment.region = textureRegion;
      attachment.updateRegion();
    }
  }

  /**
   * 获取图片适应视图的尺寸和位置
   */
  static getImageFitViewport(canvasWidth: number, canvasHeight: number, imgWidth: number, imgHeight: number, fit: IBackground['fit'] = 'cover', isCanvas2D?: boolean) {
    // 计算绘制尺寸和位置（根据 fit 模式）
    let drawWidth = canvasWidth;
    let drawHeight = canvasHeight;
    let drawX = 0;
    let drawY = 0;
    const canvasAspect = canvasWidth / canvasHeight;
    const imgAspect = imgWidth / imgHeight;

    switch (fit) {
      case 'cover':
        if (imgAspect > canvasAspect) {
          drawHeight = canvasHeight;
          drawWidth = canvasHeight * imgAspect;
          drawX = (canvasWidth - drawWidth) / 2;
        } else {
          drawWidth = canvasWidth;
          drawHeight = canvasWidth / imgAspect;
          drawY = (canvasHeight - drawHeight) / 2;
        }
        break;
      case 'contain':
        if (imgAspect > canvasAspect) {
          drawWidth = canvasWidth;
          drawHeight = canvasWidth / imgAspect;
          drawY = (canvasHeight - drawHeight) / 2;
        } else {
          drawHeight = canvasHeight;
          drawWidth = canvasHeight * imgAspect;
          drawX = (canvasWidth - drawWidth) / 2;
        }
        break;
      case 'fill':
        // 直接使用 canvas 尺寸
        break;
      case 'none':
        drawWidth = imgWidth;
        drawHeight = imgHeight;
        drawX = (canvasWidth - drawWidth) / 2;
        drawY = (canvasHeight - drawHeight) / 2;
        break;
      case 'scale-down':
        const containWidth = imgAspect > canvasAspect ? canvasWidth : canvasHeight * imgAspect;
        const containHeight = imgAspect > canvasAspect ? canvasWidth / imgAspect : canvasHeight;
        if (imgWidth <= canvasWidth && imgHeight <= canvasHeight) {
          drawWidth = imgWidth;
          drawHeight = imgHeight;
          drawX = (canvasWidth - drawWidth) / 2;
          drawY = (canvasHeight - drawHeight) / 2;
        } else {
          drawWidth = containWidth;
          drawHeight = containHeight;
          drawX = (canvasWidth - drawWidth) / 2;
          drawY = (canvasHeight - drawHeight) / 2;
        }
        break;
    }
    // 将屏幕像素坐标转换为世界坐标
    if (!isCanvas2D) {
      drawX = drawX - canvasWidth / 2;
      drawY = canvasHeight / 2 - drawY - drawHeight;
    }
    return { drawWidth, drawHeight, drawX, drawY };
  }

  /**
   * 将 positionOffset 规范为画布 CSS 像素（x 向右、y 向上为正）。
   * 支持 number、数字字符串、可选 px 后缀、百分比（须传入 canvasCssSize 对应轴尺寸）。
   */
  static positionOffsetToNumber(
    positionOffset: ISpineConfig['positionOffset'],
    canvasCssSize?: { width: number; height: number },
    dpr: number = 1,
  ): { x: number; y: number } {
    if (
      positionOffset == null ||
      typeof positionOffset !== 'object' ||
      Array.isArray(positionOffset)
    ) {
      return { x: 0, y: 0 };
    }
    const w = canvasCssSize?.width;
    const h = canvasCssSize?.height;
    return {
      x: parseValueToNumber(positionOffset.x, w, dpr),
      y: parseValueToNumber(positionOffset.y, h, dpr),
    };
  }
}