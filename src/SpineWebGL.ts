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
  ISpineConfig,
  ISpineOptions,
  IBound,
  ISpineFilters,
  IUpdateConfig,
  IBonePosition,
  IBackground,
  OnUpdateCallback,
} from "./type";

export default class SpineWebGL {
  /**
   * 配置
   */
  private config!: ISpineConfig;
  private loop!: boolean;
  private onUpdate!: OnUpdateCallback | undefined;
  private followSlots: Map<string, (arg1?: IBonePosition) => void> = new Map();
  private backgroundConfig!: IBackground | null;
  private backgroundColor!: { r: number; g: number; b: number; a: number };

  /**
   * 属性
   */
  public gl!: WebGLRenderingContext;
  public htmlCanvas: HTMLCanvasElement;
  public animationName!: string; // 当前的动画名称
  public assetManager!: AssetManager;
  public animationState!: AnimationState;
  public skeleton!: Skeleton;
  public isLoaded!: boolean; // 是否加载完成
  public isPaused!: boolean; // 是否已暂停

  // 帧回调id
  private rafId = -1;
  /** is disposed */
  private disposed = false;
  /** Tracks the current time, delta, and other time related statistics. */
  private time = new TimeKeeper();
  /** The canvas context. */
  private context: ManagedWebGLRenderingContext;
  /** The scene renderer for easy drawing of skeletons, shapes, and images. */
  private renderer!: SceneRenderer;
  /** The bounds of the skeleton. */
  private bounds!: IBound;
  /** The filters of the spine. */
  private filters!: ISpineFilters | undefined;
  /** The original shader of the spine. */
  private originalShader!: Shader;

  constructor(el: HTMLElement | HTMLCanvasElement, options: ISpineOptions) {
    this.onUpdate = options.onUpdate;
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

  /**
   * 加载spine动画
   */
  public async loadSpine(config: ISpineConfig) {
    if (this.isDisposed) {
      logger.warning("当前实例已销毁，无法加载动画");
      return;
    }
    // 销毁之前的动画
    this.stop();
    this.cleanCurrentAnimation(config.cleanAssetsCache);
    // 验证配置
    SpineUtils.validateConfig(config);
    // 初始化配置
    this.config = config;
    this.loop = config.loop || false;
    this.filters = config.filters || void 0;
    this.animationName = config.animationName || "";
    // 默认自动播放
    if (config.autoPlay === void 0) {
      this.config.autoPlay = true;
    }
    // 加载资源
    const { isBinary, skelData, atlasData } = await SpineUtils.loadAssets(
      config,
      this.assetManager,
      this.context,
    );
    if (this.isDisposed) {
      this.dispose();
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
    this.skeleton = new Skeleton(skeletonData);
    // 如果默认皮肤不存在，则设置为第一个皮肤
    if (!skeletonData.defaultSkin) {
      this.skeleton.setSkinByName(this.getSkins()[0]);
    }
    // Create an AnimationState, and set the "run" animation in looping mode.
    const animationStateData = new AnimationStateData(skeletonData);
    animationStateData.defaultMix = DEFAULT_MIX;
    this.animationState = new AnimationState(animationStateData);
    // 是否开启统一混合模式
    if (config.uniBlendMode) {
      this.uniBlendMode(this.skeleton);
    }
    // add event listener
    SpineUtils.addEventListeners(this.animationState, this.config);
    // set shader
    this.setShader();
    // set animationName
    if (!this.animationName) {
      this.animationName = this.getAnimations()[0];
    }
    // set bounds
    this.setBounds();
    // loaded
    this.isLoaded = true;
    if (this.config?.hooks?.onLoaded) {
      this.config?.hooks?.onLoaded(this);
    }
    // start
    if (this.config.autoPlay) {
      this.start();
    } else if (this.config.renderFirstScreen) {
      this.drawStatic(this.animationName);
    } else {
      this.setAnimationName(this.animationName);
    }
  }

  private uniBlendMode(skeleton: Skeleton) {
    skeleton.drawOrder.forEach((item) => {
      item.data.blendMode = 0;
    });
  }

  private setShader() {
    if (
      this.filters &&
      SpineUtils.canUseShader(this.filters.type, this.filters.params)
    ) {
      // @ts-ignore
      this.renderer.batcherShader = SpineUtils.setShader(
        this.filters.type!,
        this.context,
        this.htmlCanvas,
        this.filters.params,
      );
    } else {
      // @ts-ignore
      this.renderer.batcherShader = this.originalShader;
    }
  }

  private setBounds() {
    if (!this.animationName || !this.skeleton) return;
    const animation = this.skeleton.data.findAnimation(this.animationName);
    if (!animation) return;
    this.bounds = SpineUtils.calculateAnimationViewport(
      this.skeleton,
      animation,
      this.config.dynamicCalcBound,
    );
  }

  /**
   * 更新动画
   */
  private update() {
    if (!this.skeleton || !this.animationState) return;
    this.time.update();
    // Update the animation state using the delta time.
    this.animationState.update(this.time.delta);
    // Apply the animation state to the skeleton.
    this.animationState.apply(this.skeleton);
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
    if (immediatelyRender) this.renderer.begin();
    this.renderer.drawTexture(texture, drawX, drawY, drawWidth, drawHeight);
    if (immediatelyRender) this.renderer.end();
  }

  private draw() {
    // update
    this.update();
    // resize
    this.resize();
    // Check and draw background
    this.drawBackground();
    // Begin rendering.
    this.renderer.begin();
    // Draw the skeleton
    if (this.skeleton) {
      const premultipliedAlpha = this.config?.premultipliedAlpha || false;
      this.renderer.drawSkeleton(this.skeleton, premultipliedAlpha);
      if (this.config?.debugMode) {
        this.renderer.drawSkeletonDebug(this.skeleton, premultipliedAlpha);
      }
    }
    // Complete rendering.
    this.renderer.end();
  }

  /**
   * 渲染
   */
  private render(first?: boolean) {
    if (this.isPaused) return;

    // onUpdate
    try {
      if (this.onUpdate) {
        this.onUpdate(this.time, this.renderer.batcher.getDrawCalls());
      }
    } catch (err) {
      logger.warning("onUpdate 出错:", err);
    }

    try {
      // draw
      this.draw();

      // update slot follow
      this.updateSlotFollow();

      // firstRender
      if (first && this.config?.hooks?.onFirstDraw) {
        this.config?.hooks?.onFirstDraw(this);
      }
    } catch (err) {
      logger.error("渲染出错:", err);
    }

    // repeat raf
    this.rafId = requestAnimationFrame(() => {
      this.render();
    });
  }

  private resize() {
    if (!this.skeleton) return;

    // Resize the viewport to the full canvas.
    this.renderer.resize(ResizeMode.Expand);

    // 计算合适的缩放比例（保持宽高比）
    const customScale = this.config.customScale || 1;
    const scaleX = this.htmlCanvas.width / this.bounds.width;
    const scaleY = this.htmlCanvas.height / this.bounds.height;
    const scale = Math.min(scaleX, scaleY) * customScale; // 使用 Math.min 而不是 Math.max，确保完整显示

    // 应用统一的缩放
    this.skeleton.scaleX = scale;
    this.skeleton.scaleY = scale;

    // const dpr = window.devicePixelRatio || 1;

    // 设置位置（考虑边界框的偏移）
    this.skeleton.x = -(this.bounds.width / 2 + this.bounds.x) * scale;
    this.skeleton.y = -(this.bounds.height / 2 + this.bounds.y) * scale;

    // 更新世界变换
    this.skeleton.updateWorldTransform(Physics.update);
  }

  public clear(r: number = 0, g: number = 0, b: number = 0, a: number = 0) {
    this.gl.clearColor(r, g, b, a);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
  }

  /**
   * 更换插槽内容
   */
  public changeSlot(slotName: string, attachmentName: string) {
    if (!this.skeleton) return;
    const slot = this.skeleton.findSlot(slotName);
    const newAttachment = this.skeleton.getAttachmentByName(
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
  public changeSkin(skin: string) {
    this.skeleton.setSkinByName(skin);
  }

  /**
   * 获取插槽附件
   */
  public getSlotAttachment(slotName: string) {
    if (!this.skeleton) return null;
    const slot = this.skeleton.findSlot(slotName);
    return slot?.getAttachment() || null;
  }

  /**
   * 更换插槽纹理
   */
  public hackTextureBySlotName(
    slotName: string,
    textureName: string,
    persistent?: boolean,
  ) {
    return SpineUtils.hackTextureBySlotName(
      this.skeleton,
      this.assetManager,
      textureName,
      slotName,
      persistent,
    );
  }

  public updateConfig(config: IUpdateConfig) {
    SpineUtils.validateConfig(config);
    this.config = { ...this.config, ...config };
  }

  /**
   * 增加slot挂点跟随
   */
  public addSlotFollowListener(
    slotName: string,
    callback: (arg1?: IBonePosition) => void,
  ) {
    if (this.followSlots.get(slotName)) {
      logger.warning(
        `当前slotName【${slotName}】挂点跟随监听已存在，请勿重复添加`,
      );
      return;
    }
    this.followSlots.set(slotName, callback);
  }

  public removeSlotFollowListener(slotName: string) {
    if (!this.followSlots.get(slotName)) {
      this.followSlots.delete(slotName);
    }
  }

  private updateSlotFollow() {
    try {
      if (!this.skeleton) return;
      for (const [slotName, callback] of this.followSlots) {
        const slot = this.skeleton.findSlot(slotName);
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
   * 加载纹理图片
   */
  public async loadTexture(texture: string | Record<string, string>) {
    if (!texture) return;
    SpineUtils.loadTexture(
      texture,
      this.assetManager,
      this.config?.assets?.basePath,
    );
    await this.assetManager.loadAll();
  }

  /**
   * 移除纹理图片
   */
  public removeTexture(textureKey: string) {
    this.assetManager.remove(textureKey);
  }

  /**
   * 设置动画过渡时间
   */
  public setMix(mix: number) {
    if (!this.animationState) return;
    this.animationState.data.defaultMix = mix ?? DEFAULT_MIX;
  }

  public getVersion() {
    if (!this.skeleton) return "";
    return this.skeleton.data.version;
  }

  public getBounds() {
    return this.bounds;
  }

  public getEvents() {
    if (!this.skeleton) return [];
    return this.skeleton.data.events || [];
  }

  public setTimeScale(timeScale: number) {
    if (!this.animationState) return;
    this.animationState.timeScale = timeScale;
  }

  /**
   * 获取所有皮肤
   */
  public getSkins() {
    if (!this.skeleton) return [];
    const skeletonData = this.skeleton.data;
    const skins = skeletonData.skins || [];
    return skins.map((skin) => skin.name);
  }

  /**
   * 获取所有动画
   */
  public getAnimations() {
    if (!this.skeleton) return [];
    const skeletonData = this.skeleton.data;
    const animations = skeletonData.animations || [];
    return animations.map((animation) => animation.name);
  }

  /**
   * 检查是否有该动画
   */
  public hasAnimation(animationName: string) {
    if (!animationName || !this.skeleton) return false;
    const skeletonData = this.skeleton.data;
    const animations = skeletonData.animations || [];
    return animations.some((animation) => animation.name === animationName);
  }

  /**
   * 设置动画名称
   */
  public setAnimationName(
    animationName: string,
    loop?: boolean,
    trackIndex?: number,
  ) {
    if (!this.hasAnimation(animationName)) {
      logger.error("该动画不存在");
      return false;
    }
    if (this.animationName !== animationName) {
      this.animationName = animationName;
      this.setBounds();
    }
    if (loop !== void 0) this.loop = loop;
    this.animationState.setAnimation(trackIndex || 0, animationName, this.loop);
    return true;
  }

  /**
   * 绘制静态动画第一帧
   */
  public drawStatic(animationName: string, trackIndex?: number) {
    this.setAnimationName(animationName, void 0, trackIndex);
    this.draw();
  }

  /**
   * 播放指定动画
   */
  public playAnimation(
    animationName: string,
    loop?: boolean,
    trackIndex?: number,
  ) {
    try {
      if (!this.animationState) {
        logger.error("动画数据未完成加载");
        return;
      }
      // Set new animation
      const success = this.setAnimationName(animationName, loop, trackIndex);
      if (!success) return;
      // Start new render loop
      if (this.isPaused) {
        this.isPaused = false;
        this.render(true);
      }
    } catch (err) {
      logger.error("播放出错:", err);
    }
  }

  /**
   * 跳转到指定时间节点并渲染
   * @param time 时间（秒）
   * @param trackIndex 动画轨道索引，默认为 0
   */
  public seekToTime(time: number, trackIndex: number = 0) {
    if (typeof time !== "number" || time < 0) {
      logger.warning("时间参数必须是大于等于0的数字");
      return;
    }
    if (!this.animationState || !this.skeleton) {
      logger.warning("动画数据未完成加载");
      return;
    }
    const track = this.animationState.tracks[trackIndex];
    if (!track) {
      logger.warning("当前动画轨道不存在");
      return;
    }
    // 设置轨道时间
    track.trackTime = time;
    // 立即应用动画状态到骨骼
    this.animationState.apply(this.skeleton);
    this.skeleton.updateWorldTransform(Physics.update);
    // 如果当前是暂停状态，需要手动绘制一帧
    if (this.isPaused) this.draw();
  }

  /**
   * 获取动画总时长
   * @param animationName 动画名称，不传则使用当前动画
   * @returns 动画时长（秒）
   */
  public getAnimationDuration(animationName?: string): number {
    if (!this.skeleton) {
      return 0;
    }
    const name = animationName || this.animationName;
    const animation = this.skeleton.data.findAnimation(name);
    return animation ? animation.duration : 0;
  }

  /**
   * 开始播放
   */
  public start() {
    this.stop();
    this.animationName = this.animationName || this.getAnimations()[0];
    this.playAnimation(this.animationName);
  }

  /**
   * 恢复播放动画
   */
  public resume() {
    if (!this.isPaused) return;
    this.isPaused = false;
    this.render();
  }

  /**
   * 暂停动画
   */
  public stop() {
    this.isPaused = true;
    if (this.rafId !== -1) {
      cancelAnimationFrame(this.rafId);
    }
  }

  /**
   * 销毁
   */
  public dispose() {
    this.stop();
    // 清除画布
    this.clear();
    // 释放渲染器
    this.renderer.dispose();
    // 清除当前动画
    this.cleanCurrentAnimation(true);
    // fix Too many active WebGL contexts. Oldest context will be lost.
    try {
      this.gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch (err) {
      logger.warning("GL lose context Err", err);
    }
    this.disposed = true;
  }

  private cleanCurrentAnimation(cleanCache?: boolean) {
    // 移除事件监听
    if (this.animationState && this.animationState.clearListeners) {
      this.animationState.clearListeners();
    }
    // 移除所有slot挂点跟随监听
    if (this.followSlots && this.followSlots.size > 0) {
      this.followSlots.clear();
    }
    // 移除所有资源
    if (cleanCache && this.assetManager && this.assetManager.removeAll) {
      this.assetManager.removeAll();
    }
  }
}
