import SpineWebGL from './SpineWebGL';
import SpineCanvas from './SpineCanvas';
import type { ISpineConfig, ISpineOptions, IUpdateConfig, IBonePosition, IBackground } from './type';

export default class SpinePlayer {
  private instance!: SpineWebGL | SpineCanvas;

  constructor(el: HTMLElement | HTMLCanvasElement, options?: ISpineOptions) {
    options = options || <ISpineOptions>{};
    options.type = options.type || 'auto';
    if (options.type === 'webgl') {
      // 指定使用webgl渲染
      this.instance = new SpineWebGL(el, options);
    } else if (options.type === 'canvas2d') {
      // 指定使用canvas渲染
      this.instance = new SpineCanvas(el, options);
    } else {
      // 检查是否支持 WebGL
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        this.instance = new SpineWebGL(el, options);
      } else {
        this.instance = new SpineCanvas(el, options);
      }
    }
  }

  public get gl() {
    if (this.instance instanceof SpineWebGL) {
      return this.instance.gl
    }
    return null;
  }

  public get htmlCanvas() {
    return this.instance.htmlCanvas;
  }

  public get spineVersion() {
    return this.instance.getVersion();
  }

  public get spineBounds() {
    return this.instance.getBounds();
  }

  public get spineEvents() {
    return this.instance.getEvents();
  }

  public get animationName() {
    return this.instance.animationName;
  }

  public get assetManager() {
    return this.instance.assetManager;
  }

  public get animationState() {
    return this.instance.animationState;
  }

  public get skeleton() {
    return this.instance.skeleton;
  }

  public get isLoaded() {
    return this.instance.isLoaded;
  }

  public get isPaused() {
    return this.instance.isPaused;
  }

  public loadSpine(config: ISpineConfig) {
    return this.instance.loadSpine(config);
  }

  public loadTexture(texture: string | Record<string, string>) {
    return this.instance.loadTexture(texture);
  }

  public removeTexture(textureKey: string) {
    return this.instance.removeTexture(textureKey);
  }

  public clear() {
    return this.instance.clear();
  }

  public updateConfig(config: IUpdateConfig) {
    return this.instance.updateConfig(config);
  }

  public setMix(mix: number) {
    return this.instance.setMix(mix);
  }

  public setTimeScale(timeScale: number) {
    return this.instance.setTimeScale(timeScale);
  }

  public setBackground(background?: IBackground | string, immediatelyRender?: boolean) {
    return this.instance.setBackground(background, immediatelyRender);
  }

  public changeSlot(slotName: string, attachmentName: string) {
    return this.instance.changeSlot(slotName, attachmentName);
  }

  public changeSkin(skin: string) {
    return this.instance.changeSkin(skin);
  }

  public hackTextureBySlotName(
    slotName: string,
    textureName: string,
    persistent?: boolean,
  ) {
    return this.instance.hackTextureBySlotName(slotName, textureName, persistent);
  }

  public getSlotAttachment(slotName: string) {
    return this.instance.getSlotAttachment(slotName);
  }

  public getSkins() {
    return this.instance.getSkins();
  }

  public getAnimations() {
    return this.instance.getAnimations();
  }

  public hasAnimation(animationName: string) {
    return this.instance.hasAnimation(animationName);
  }

  public playAnimation(animationName: string, loop?: boolean, trackIndex?: number) {
    return this.instance.playAnimation(animationName, loop, trackIndex);
  }

  public start() {
    return this.instance.start();
  }

  public resume() {
    return this.instance.resume();
  }

  public stop() {
    return this.instance.stop();
  }

  public dispose() {
    return this.instance.dispose();
  }

  public setAnimationName(animationName: string, loop?: boolean, trackIndex?: number) {
    return this.instance.setAnimationName(animationName, loop, trackIndex);
  }

  public drawStatic(animationName: string, trackIndex?: number) {
    return this.instance.drawStatic(animationName, trackIndex);
  }

  public seekToTime(time: number, trackIndex: number = 0) {
    return this.instance.seekToTime(time, trackIndex);
  }

  public getAnimationDuration(animationName?: string) {
    return this.instance.getAnimationDuration(animationName);
  }

  public addSlotFollowListener(slotName: string, callback: (arg1?: IBonePosition) => void) {
    return this.instance.addSlotFollowListener(slotName, callback);
  }

  public removeSlotFollowListener(slotName: string) {
    return this.instance.removeSlotFollowListener(slotName);
  }
}
