import {
  Shader,
  Physics,
  Skeleton,
  AssetManager,
  AnimationState,
  TimeKeeper,
  SceneRenderer,
  SkeletonJson,
  SkeletonBinary,
  ResizeMode,
  Event as SpineEvent,
  AnimationStateData,
  AtlasAttachmentLoader,
  ManagedWebGLRenderingContext,
} from "@esotericsoftware/spine-webgl";
import logger from "./utils/logger";
import SpineUtils from "./SpineUtils";
import { parseColor } from "./utils/tool";
import { DEFAULT_MIX } from "./utils/constant";
import type {
  ISpineMangeConfig,
  ISpineMangeOptions,
  IBound,
  IRenderItem,
  ISpineFilters,
  IBonePosition,
  IBackground,
  OnUpdateCallback,
} from "./type";

export default class SpineManage {
  private context: ManagedWebGLRenderingContext;
  private renderer: SceneRenderer;
  private rafId: number | null = null;
  private time: TimeKeeper = new TimeKeeper();
  private disposed = false;

  /**
   * map data
   */
  private skeletons: Map<string, Skeleton> = new Map();
  private animationStates: Map<string, AnimationState> = new Map();
  private bounds: Map<string, IBound> = new Map();
  private customBounds: Map<string, IBound> = new Map();
  private renderArray: Array<IRenderItem> = [];
  /** The original shader of the spine. */
  private originalShader!: Shader;
  /** The background config of the spine. */
  private backgroundConfig!: IBackground | null;
  private backgroundColor!: { r: number; g: number; b: number; a: number };

  /**
   * 实例属性
   */
  public gl!: WebGLRenderingContext;
  public assetManager: AssetManager;
  public htmlCanvas: HTMLCanvasElement;
  public onUpdate!: OnUpdateCallback | undefined;

  constructor(
    el: HTMLElement | HTMLCanvasElement,
    options?: ISpineMangeOptions,
  ) {
    this.onUpdate = options?.onUpdate;
    this.htmlCanvas = SpineUtils.getCanvas(el);
    this.context = new ManagedWebGLRenderingContext(this.htmlCanvas, {
      alpha: true,
    });
    this.gl = this.context.gl;
    this.renderer = new SceneRenderer(this.htmlCanvas, this.context, true);
    this.renderer.resize(ResizeMode.Expand);
    // @ts-ignore
    this.originalShader = this.renderer.batcherShader;
    this.assetManager = new AssetManager(this.context);
    // 设置背景
    this.setBackground(options?.background);
  }

  public get isDisposed() {
    return this.disposed;
  }

  /**
   * 设置背景
   */
  public async setBackground(
    background?: IBackground | string,
    immediatelyRender?: boolean,
  ) {
    if (!background) {
      this.backgroundColor = { r: 0, g: 0, b: 0, a: 0 };
      this.backgroundConfig = null;
      return;
    }
    if (typeof background === "string") {
      if (
        background.startsWith("#") ||
        background.startsWith("rgb") ||
        background.startsWith("rgba")
      ) {
        this.backgroundConfig = { color: background };
      } else {
        this.backgroundConfig = { imageUrl: background, fit: "cover" };
      }
    } else {
      this.backgroundConfig = background;
    }
    // 提前解析背景颜色，避免每次绘制时都解析
    if (this.backgroundConfig?.color) {
      this.backgroundColor = parseColor(this.backgroundConfig.color);
    } else {
      this.backgroundColor = { r: 0, g: 0, b: 0, a: 0 };
    }
    // 加载背景图片
    await this.loadBackgroundImage();
    // 是否需要立即绘制背景
    if (immediatelyRender) {
      this.drawBackground(immediatelyRender);
    }
  }

  /**
   * 加载背景图片
   */
  private async loadBackgroundImage(): Promise<void> {
    if (!this.backgroundConfig?.imageUrl) return;
    const imageUrl = this.backgroundConfig.imageUrl;
    const cacheKey = this.backgroundConfig.cacheKey || imageUrl;
    try {
      await this.loadTexture({
        [cacheKey]: imageUrl,
      });
    } catch (err) {
      logger.error("背景图片加载失败:", err);
    }
  }

  public async loadSpine(config: ISpineMangeConfig): Promise<void> {
    if (this.isDisposed) {
      logger.warning("当前实例已销毁，无法加载动画");
      return;
    }
    const { uuid } = config;
    // 加载资源
    const { isBinary, skelData, atlasData, skelSrc, atlasSrc } =
      await SpineUtils.loadAssets(config, this.assetManager, this.context);
    if (this.isDisposed) {
      this.disposeAll();
      return;
    }
    // Create a AtlasAttachmentLoader that resolves region, mesh, boundingbox and path attachments
    const atlasLoader = new AtlasAttachmentLoader(atlasData);
    // Create a SkeletonBinary instance for parsing the .skel file.
    let skeletonBinary: SkeletonJson | SkeletonBinary;
    if (isBinary) {
      skeletonBinary = new SkeletonBinary(atlasLoader);
    } else {
      skeletonBinary = new SkeletonJson(atlasLoader);
    }
    // Set the scale to apply during parsing, parse the file, and create a new skeleton.
    skeletonBinary.scale = 1;
    const skeletonData = skeletonBinary.readSkeletonData(skelData);
    // 检查版本
    SpineUtils.checkVersion(skeletonData.version);
    // 创建skeleton实例
    const skeleton = new Skeleton(skeletonData);
    // 如果默认皮肤不存在，则设置为第一个皮肤
    if (!skeletonData.defaultSkin) {
      skeleton.setSkinByName(skeleton.data.skins?.[0]?.name || "");
    }
    // Let the skeleton update the transforms of its bones.
    skeleton.updateWorldTransform(Physics.update);
    // Create an AnimationState, and set the "run" animation in looping mode.
    const animationStateData = new AnimationStateData(skeletonData);
    animationStateData.defaultMix = DEFAULT_MIX;
    const animationState = new AnimationState(animationStateData);
    // 是否开启统一混合模式
    if (config.uniBlendMode) {
      this.uniBlendMode(skeleton);
    }
    // 缓存数据
    this.renderArray.push({
      uuid,
      skel: skelSrc,
      atlas: atlasSrc,
      zIndex: config.zIndex || 0,
      debugMode: config.debugMode || false,
      isHidden: config.autoPlay === false && !config.renderFirstScreen,
      isPaused: config.autoPlay === void 0 ? false : !config.autoPlay,
      filters: config.filters,
      premultipliedAlpha: config.premultipliedAlpha || false,
    });
    // this.renderArray.sort((a, b) => a.atlas.localeCompare(b.atlas));
    this.sortRenderArray(); // 渲染层级排序
    this.bounds.set(uuid, skeleton.getBoundsRect());
    this.skeletons.set(uuid, skeleton);
    this.animationStates.set(uuid, animationState);
    // 设置自定义边界
    if (config.bound) this.customBounds.set(uuid, config.bound);
    // add event listener
    SpineUtils.addEventListeners(animationState, config);
    // loaded
    if (config.hooks?.onLoaded) {
      config.hooks?.onLoaded(this);
    }
    // 检查自动播放
    if (config.autoPlay === void 0 || config.autoPlay) {
      this.playAnimation(uuid, {
        animationName: config.animationName,
        loop: config.loop,
        bound: config.bound,
      });
    } else {
      const aniName = config.animationName || this.getAnimations(uuid)[0];
      animationState.setAnimation(0, aniName, config.loop || false);
    }
  }

  private sortRenderArray() {
    this.renderArray.sort((a, b) => {
      const zIndexA = a.zIndex || 0;
      const zIndexB = b.zIndex || 0;
      if (zIndexA !== zIndexB) {
        return zIndexA - zIndexB;
      }
      return a.atlas.localeCompare(b.atlas);
    });
  }

  private uniBlendMode(skeleton: Skeleton) {
    skeleton.drawOrder.forEach((item) => {
      item.data.blendMode = 0;
    });
  }

  private resize(skeleton: Skeleton, bound: IBound, customBound?: IBound) {
    if (!skeleton) return;

    // 展开视口
    this.renderer.resize(ResizeMode.Expand);

    if (!customBound) {
      // 计算合适的缩放比例（保持宽高比）
      const scaleX = this.htmlCanvas.width / bound.width;
      const scaleY = this.htmlCanvas.height / bound.height;
      const scale = Math.min(scaleX, scaleY); // 使用 Math.min 而不是 Math.max，确保完整显示

      // 应用统一的缩放
      skeleton.scaleX = scale;
      skeleton.scaleY = scale;
      // 设置位置（考虑边界框的偏移）
      skeleton.x = -(bound.width / 2 + bound.x) * scale;
      skeleton.y = -(bound.height / 2 + bound.y) * scale;
    } else {
      const dpr = window.devicePixelRatio || 1;
      const anchorX = customBound.anchorX || 0;
      const anchorY = customBound.anchorY || 0;
      // 计算合适的缩放比例（保持宽高比）
      const scaleX = (customBound.width * dpr) / bound.width;
      const scaleY = (customBound.height * dpr) / bound.height;
      const scale = Math.min(scaleX, scaleY); // 使用 Math.min 而不是 Math.max，确保完整显示
      // 应用统一的缩放
      skeleton.scaleX = scale;
      skeleton.scaleY = scale;
      // 计算缩放后的实际尺寸
      const offsetX =
        -(bound.width / 2 + bound.x) * scale - this.htmlCanvas.width / 2;
      const offsetY =
        -(bound.height / 2 + bound.y) * scale - this.htmlCanvas.height / 2;
      const anchorW = bound.width * scale * (0.5 - anchorX);
      const anchorH = bound.height * scale * (0.5 - anchorY);
      // 设置位置（考虑边界框的偏移）
      skeleton.x = customBound.x * dpr + offsetX + anchorW;
      skeleton.y = customBound.y * dpr + offsetY + anchorH;
    }

    // 更新世界变换
    skeleton.updateWorldTransform(Physics.update);
  }

  private drawBackground(immediatelyRender?: boolean) {
    const color = this.backgroundColor || { r: 0, g: 0, b: 0, a: 0 };
    this.clear(color.r, color.g, color.b, color.a);
    if (!this.backgroundConfig || !this.backgroundConfig.imageUrl) return;
    const { imageUrl, cacheKey, fit } = this.backgroundConfig;
    const texture = this.assetManager.get(cacheKey || imageUrl);
    if (!texture) {
      return;
    }
    const image = texture.getImage();
    const canvasWidth = this.htmlCanvas.width;
    const canvasHeight = this.htmlCanvas.height;
    const imgWidth = image.width;
    const imgHeight = image.height;
    const { drawWidth, drawHeight, drawX, drawY } =
      SpineUtils.getImageFitViewport(
        canvasWidth,
        canvasHeight,
        imgWidth,
        imgHeight,
        fit,
      );
    // @ts-ignore
    this.renderer.batcherShader = this.originalShader;
    this.renderer.drawTexture(texture, drawX, drawY, drawWidth, drawHeight);
    if (immediatelyRender) this.renderer.end();
  }

  private render(): void {
    // onUpdate
    try {
      if (this.onUpdate) {
        this.onUpdate(this.time, this.renderer.batcher.getDrawCalls());
      }
    } catch (err) {
      logger.warning("onUpdate 出错:", err);
    }

    try {
      // update time
      this.time.update();

      // draw background
      this.drawBackground();

      // 更新和渲染所有骨骼
      let prevFilterType: ISpineFilters["type"] | null = null;
      this.renderArray.forEach((item, i) => {
        if (item.isHidden) return;
        const id = item.uuid;
        const skeleton = this.skeletons.get(id);
        const animationState = this.animationStates.get(id);
        const bound = this.bounds.get(id);
        const customBound = this.customBounds.get(id);
        if (animationState && bound && skeleton) {
          if (!item.isPaused) {
            animationState.update(this.time.delta);
          }
          animationState.apply(skeleton);
          this.resize(skeleton, bound, customBound);
          // 设置shader
          let curType: ISpineFilters["type"] =
            item.filters?.type ?? SpineUtils.ShaderType.NONE;
          if (!SpineUtils.canUseShader(curType, item.filters?.params)) {
            curType = SpineUtils.ShaderType.NONE;
          }
          if (prevFilterType !== null && prevFilterType !== curType) {
            this.renderer.end(); // 如果上一次的shader和当前的shader不一致，则结束渲染重新开始
          }
          if (curType !== SpineUtils.ShaderType.NONE) {
            // @ts-ignore
            this.renderer.batcherShader = SpineUtils.setShader(
              curType,
              this.context,
              this.htmlCanvas,
              item.filters?.params,
            );
          } else {
            // @ts-ignore
            this.renderer.batcherShader = this.originalShader;
          }
          prevFilterType = curType;
          // draw
          this.renderer.drawSkeleton(
            skeleton,
            item.premultipliedAlpha || false,
          );
          if (item.debugMode) {
            this.renderer.drawSkeletonDebug(
              skeleton,
              item.premultipliedAlpha || false,
            );
          }
          // update slot follow
          this.updateSlotFollow(id);
        }
      });
      // 结束渲染
      this.renderer.end();
    } catch (err) {
      logger.error("渲染出错:", err);
    }

    // 继续渲染循环
    this.rafId = requestAnimationFrame(() => this.render());
  }

  private clear(r: number, g: number, b: number, a: number) {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  private getRenderItem(uuid: string) {
    return this.renderArray.find((item) => item.uuid === uuid);
  }

  public getPlayStatus(uuid: string) {
    return this.getRenderItem(uuid) || null;
  }

  /**
   * 增加slot挂点跟随
   */
  public addSlotFollowListener(
    uuid: string,
    slotName: string,
    callback: (arg1?: IBonePosition) => void,
  ) {
    const item = this.getRenderItem(uuid);
    if (!item) {
      logger.warning(`当前spine【${uuid}】不存在，请先加载`);
      return;
    }
    if (!item.followSlots) {
      item.followSlots = new Map();
    } else if (item.followSlots?.get(slotName)) {
      logger.warning(
        `当前slotName【${slotName}】挂点跟随监听已存在，请勿重复添加`,
      );
      return;
    }
    item.followSlots.set(slotName, callback);
  }

  public removeSlotFollowListener(uuid: string, slotName: string) {
    const item = this.getRenderItem(uuid);
    if (!item) {
      logger.warning(`当前spine【${uuid}】不存在，请先加载`);
      return;
    }
    if (!item.followSlots?.get(slotName)) {
      logger.warning(`当前slotName【${slotName}】挂点跟随监听不存在，请先添加`);
      return;
    }
    item.followSlots.delete(slotName);
  }

  private updateSlotFollow(uuid: string) {
    try {
      const followSlots = this.getRenderItem(uuid)?.followSlots;
      if (!followSlots) return;
      for (const [slotName, callback] of followSlots) {
        const slot = this.getSkeleton(uuid)?.findSlot(slotName);
        if (!slot) continue;
        const position = SpineUtils.calcBonePosition(
          slot,
          this.renderer,
          this.htmlCanvas,
        );
        if (position && callback) callback(position);
      }
    } catch (err) {
      logger.error("更新slot挂点跟随出错:", err);
    }
  }

  /**
   * 动态更新动画坐标边界
   */
  public updateBound(uuid: string, bound: IBound) {
    if (!uuid) return;
    if (!this.bounds.get(uuid)) {
      logger.warning(`当前spine【${uuid}】不存在，请先加载`);
      return;
    }
    this.customBounds.set(uuid, bound);
  }

  /**
   * 播放指定动画
   */
  public playAnimation(
    uuid: string,
    options?: {
      animationName?: string;
      loop?: boolean;
      bound?: IBound;
      trackIndex?: number;
    },
  ): void {
    const {
      animationName,
      loop = false,
      bound,
      trackIndex = 0,
    } = options || {};
    const aniName = animationName || this.getAnimations(uuid)[0];
    if (!this.hasAnimation(uuid, aniName)) {
      logger.error("该动画不存在");
      return;
    }
    // 设置参数
    if (bound) this.customBounds.set(uuid, bound);
    // 重头播放指定动画
    const animationState = this.animationStates.get(uuid);
    if (animationState) {
      animationState.setAnimation(trackIndex || 0, aniName, loop);
    }
    // 恢复动画状态
    this.resume(uuid);
    // 开始播放
    this.start();
  }

  /**
   * 隐藏指定spine
   */
  public hide(uuid: string) {
    const item = this.getRenderItem(uuid);
    if (item) {
      item.isHidden = true;
    }
  }

  /**
   * 恢复播放
   */
  public resume(uuid: string) {
    const item = this.getRenderItem(uuid);
    if (item) {
      item.isHidden = false;
      item.isPaused = false;
    }
  }

  /**
   * 暂停播放
   */
  public pause(uuid: string) {
    const item = this.getRenderItem(uuid);
    if (item) {
      item.isPaused = true;
    }
  }

  /**
   * 开始播放
   */
  public start(): void {
    if (this.rafId === null) {
      this.render();
    }
  }

  /**
   * 停止播放
   */
  public stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  public getAnimationName(uuid: string) {
    const animationState = this.getAnimationState(uuid);
    return (
      animationState?.getCurrent(0)?.animation?.name ||
      this.getAnimations(uuid)[0]
    );
  }

  public getSkeleton(uuid: string) {
    return this.skeletons.get(uuid) || null;
  }

  public getAnimationState(uuid: string) {
    return this.animationStates.get(uuid) || null;
  }

  /**
   * 更换插槽内容
   */
  public changeSlot(uuid: string, slotName: string, attachmentName: string) {
    const skeleton = this.getSkeleton(uuid);
    if (!skeleton) return;
    const slot = skeleton.findSlot(slotName);
    const newAttachment = skeleton.getAttachmentByName(
      slotName,
      attachmentName,
    );
    // console.log(slot, newAttachment);
    if (slot !== null && newAttachment) {
      slot.attachment = newAttachment;
    }
  }
  /**
   * 更换皮肤
   */
  public changeSkin(uuid: string, skin: string) {
    const skeleton = this.getSkeleton(uuid);
    if (!skeleton) return;
    skeleton.setSkinByName(skin);
  }

  /**
   * 获取插槽附件
   */
  public getSlotAttachment(uuid: string, slotName: string) {
    const skeleton = this.getSkeleton(uuid);
    if (!skeleton) return null;
    const slot = skeleton.findSlot(slotName);
    return slot?.getAttachment() || null;
  }

  /**
   * 更换插槽纹理
   */
  public hackTextureBySlotName(
    uuid: string,
    slotName: string,
    textureName: string,
    persistent?: boolean,
  ) {
    const skeleton = this.getSkeleton(uuid);
    if (!skeleton) return;
    return SpineUtils.hackTextureBySlotName(
      skeleton,
      this.assetManager,
      textureName,
      slotName,
      persistent,
    );
  }

  /**
   * 跳转到指定时间节点并渲染
   * @param time 时间（秒）
   * @param trackIndex 动画轨道索引，默认为 0
   */
  public seekToTime(uuid: string, time: number, trackIndex: number = 0) {
    if (typeof time !== "number" || time < 0) {
      logger.warning("时间参数必须是大于等于0的数字");
      return;
    }
    const animationState = this.animationStates.get(uuid);
    const skeleton = this.skeletons.get(uuid);
    if (!animationState || !skeleton) {
      logger.warning("动画数据未完成加载");
      return;
    }
    const track = animationState.tracks[trackIndex];
    if (!track) {
      logger.warning("当前动画轨道不存在");
      return;
    }
    // 设置轨道时间 & 动画时间
    track.trackTime = time;
    track.setAnimationLast(time);
  }

  /**
   * 获取动画总时长
   * @param animationName 动画名称，不传则使用当前动画
   * @returns 动画时长（秒）
   */
  public getAnimationDuration(uuid: string, animationName?: string): number {
    const skeleton = this.getSkeleton(uuid);
    if (!skeleton) {
      return 0;
    }
    const name = animationName || this.getAnimationName(uuid);
    const animation = skeleton.data.findAnimation(name);
    return animation ? animation.duration : 0;
  }

  /**
   * 设置动画层级
   */
  public setZIndex(uuid: string, zIndex: number) {
    const item = this.getRenderItem(uuid);
    if (item && item.zIndex !== zIndex) {
      item.zIndex = zIndex;
      this.sortRenderArray(); // 渲染排序
    }
  }

  /**
   * 设置动画过渡时间
   */
  public setMix(uuid: string, mix: number) {
    const animationState = this.animationStates.get(uuid);
    if (animationState) {
      animationState.data.defaultMix = mix ?? DEFAULT_MIX;
    }
  }

  public getVersion(uuid: string) {
    const skeleton = this.getSkeleton(uuid);
    if (!skeleton) return "";
    return skeleton.data.version;
  }

  public getBounds(uuid: string) {
    return this.bounds.get(uuid) || null;
  }

  public getEvents(uuid: string) {
    const skeleton = this.getSkeleton(uuid);
    if (!skeleton) return [];
    return skeleton.data.events || [];
  }

  public setTimeScale(uuid: string, timeScale: number) {
    const animationState = this.animationStates.get(uuid);
    if (animationState) {
      animationState.timeScale = timeScale;
    }
  }

  /**
   * 获取所有皮肤
   */
  public getSkins(uuid: string) {
    const skeleton = this.skeletons.get(uuid);
    if (!skeleton) return [];
    return skeleton.data.skins.map((skin) => skin.name);
  }

  /**
   * 获取所有动画
   */
  public getAnimations(uuid: string) {
    const skeleton = this.skeletons.get(uuid);
    if (!skeleton) return [];
    return skeleton.data.animations.map((animation) => animation.name);
  }

  /**
   * 检查是否有该动画
   */
  public hasAnimation(uuid: string, animationName: string) {
    const skeleton = this.skeletons.get(uuid);
    if (!skeleton) return false;
    return skeleton.data.animations.some(
      (animation) => animation.name === animationName,
    );
  }

  /**
   * 加载纹理图片
   */
  public async loadTexture(texture: string | Record<string, string>) {
    if (!texture) return;
    SpineUtils.loadTexture(texture, this.assetManager);
    await this.assetManager.loadAll();
  }

  /**
   * 移除纹理图片
   */
  public removeTexture(textureKey: string) {
    this.assetManager.remove(textureKey);
  }

  private removeTextureCache(atlasPath: string) {
    const atlas = this.assetManager.get(atlasPath);
    if (atlas && atlas.pages instanceof Array) {
      const index = atlasPath.lastIndexOf("/");
      const parent = index >= 0 ? atlasPath.substring(0, index + 1) : "";
      atlas.pages.forEach((page: any) => {
        const textureName = parent + page?.name;
        const texture = this.assetManager.get(textureName);
        if (texture) {
          this.assetManager.remove(textureName);
        }
      });
    }
  }

  /**
   * 销毁指定uuid内容
   */
  public disposeByUUID(uuid: string): void {
    this.bounds.delete(uuid);
    this.customBounds.delete(uuid);
    this.skeletons.delete(uuid);
    // 移除动画事件监听 & 清理animationState
    const animationState = this.animationStates.get(uuid);
    if (animationState) {
      animationState.clearListeners();
    }
    this.animationStates.delete(uuid);
    // 按uuid清理资源
    const item = this.renderArray.find((item) => item.uuid === uuid);
    if (item) {
      // 检查skel资源是否被其他item使用
      const skelUsedByOthers = this.renderArray.some(
        (otherItem) => otherItem.uuid !== uuid && otherItem.skel === item.skel,
      );
      // 检查atlas资源是否被其他item使用
      const atlasUsedByOthers = this.renderArray.some(
        (otherItem) =>
          otherItem.uuid !== uuid && otherItem.atlas === item.atlas,
      );
      // 只有在没有其他item使用时才移除资源
      if (!skelUsedByOthers) {
        this.assetManager.remove(item.skel);
      }
      if (!atlasUsedByOthers) {
        this.removeTextureCache(item.atlas);
        this.assetManager.remove(item.atlas);
      }
    }
    // 清理renderArray
    this.renderArray = this.renderArray.filter((item) => item.uuid !== uuid);
    // 如果renderArray为空，则停止渲染
    if (this.renderArray.length === 0) {
      this.stop();
    }
  }

  /**
   * 销毁所有内容
   */
  public disposeAll(): void {
    this.stop();
    this.bounds.clear();
    this.customBounds.clear();
    this.skeletons.clear();
    this.assetManager.removeAll();
    // 移除动画事件监听 & 清理animationStates
    this.renderArray.forEach((item) => {
      const animationState = this.animationStates.get(item.uuid);
      if (animationState) {
        animationState.clearListeners();
      }
    });
    this.animationStates.clear();
    // 清理renderArray
    this.renderArray = [];
    // 销毁渲染器
    this.renderer.dispose();
    // fix Too many active WebGL contexts. Oldest context will be lost.
    try {
      this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch (err) {
      logger.warning("GL lose context Err", err);
    }
    this.disposed = true;
  }
}
