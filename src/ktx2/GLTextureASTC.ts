import {
  Texture,
  Disposable,
  Restorable,
  TextureFilter,
  TextureWrap,
  ManagedWebGLRenderingContext
} from "@esotericsoftware/spine-webgl";

/**
 * ASTC 压缩格式枚举
 * ASTC (Adaptive Scalable Texture Compression) 支持多种块大小
 */
export enum ASTCFormat {
  RGBA_4x4 = 0x93B0,
  RGBA_5x4 = 0x93B1,
  RGBA_5x5 = 0x93B2,
  RGBA_6x5 = 0x93B3,
  RGBA_6x6 = 0x93B4,
  RGBA_8x5 = 0x93B5,
  RGBA_8x6 = 0x93B6,
  RGBA_8x8 = 0x93B7,
  RGBA_10x5 = 0x93B8,
  RGBA_10x6 = 0x93B9,
  RGBA_10x8 = 0x93BA,
  RGBA_10x10 = 0x93BB,
  RGBA_12x10 = 0x93BC,
  RGBA_12x12 = 0x93BD,
  SRGB8_ALPHA8_4x4 = 0x93D0,
  SRGB8_ALPHA8_5x4 = 0x93D1,
  SRGB8_ALPHA8_5x5 = 0x93D2,
  SRGB8_ALPHA8_6x5 = 0x93D3,
  SRGB8_ALPHA8_6x6 = 0x93D4,
  SRGB8_ALPHA8_8x5 = 0x93D5,
  SRGB8_ALPHA8_8x6 = 0x93D6,
  SRGB8_ALPHA8_8x8 = 0x93D7,
  SRGB8_ALPHA8_10x5 = 0x93D8,
  SRGB8_ALPHA8_10x6 = 0x93D9,
  SRGB8_ALPHA8_10x8 = 0x93DA,
  SRGB8_ALPHA8_10x10 = 0x93DB,
  SRGB8_ALPHA8_12x10 = 0x93DC,
  SRGB8_ALPHA8_12x12 = 0x93DD
}

/**
 * ASTC 纹理数据接口
 */
export interface ASTCTextureData {
  /** 压缩纹理数据 */
  data: Uint8Array;
  /** 纹理宽度 */
  width: number;
  /** 纹理高度 */
  height: number;
  /** ASTC 格式 */
  format: ASTCFormat;
  /** mipmap 层级数据（可选） */
  mipmaps?: Array<{
    data: Uint8Array;
    width: number;
    height: number;
  }>;
}

/**
 * 支持 ASTC 纹理压缩的 WebGL 纹理类
 * 继承自 GLTexture，添加了对 ASTC 压缩纹理格式的支持
 */
export class GLTextureASTC extends Texture implements Disposable, Restorable {
  context: ManagedWebGLRenderingContext;
  private texture: WebGLTexture | null = null;
  private boundUnit = 0;
  private useMipMaps = false;
  private astcExtension: WEBGL_compressed_texture_astc | null = null;
  private textureData: ASTCTextureData;

  constructor(
    context: ManagedWebGLRenderingContext | WebGLRenderingContext,
    textureData: ASTCTextureData,
    useMipMaps: boolean = false
  ) {
    // 创建一个虚拟图像对象来满足父类构造函数
    const dummyImage = { width: textureData.width, height: textureData.height };
    super(dummyImage);

    this.context = context instanceof ManagedWebGLRenderingContext
      ? context
      : new ManagedWebGLRenderingContext(context);

    this.textureData = textureData;
    this.useMipMaps = useMipMaps && (textureData.mipmaps && textureData.mipmaps.length > 0) || false;

    // 检查 ASTC 扩展支持
    this.astcExtension = this.context.gl.getExtension('WEBGL_compressed_texture_astc');
    if (!this.astcExtension) {
      throw new Error('WEBGL_compressed_texture_astc extension is not supported');
    }

    this.restore();
    this.context.addRestorable(this);
  }

  /**
   * 检查浏览器是否支持 ASTC 压缩纹理
   */
  static isSupported(gl: WebGLRenderingContext): boolean {
    return gl.getExtension('WEBGL_compressed_texture_astc') !== null;
  }

  /**
   * 获取 ASTC 格式支持的配置文件
   */
  getSupportedProfiles(): string[] | null {
    if (!this.astcExtension) return null;
    return this.astcExtension.getSupportedProfiles();
  }

  setFilters(minFilter: TextureFilter, magFilter: TextureFilter) {
    let gl = this.context.gl;
    this.bind();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, minFilter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, this.validateMagFilter(magFilter));
  }

  private validateMagFilter(magFilter: TextureFilter): TextureFilter {
    switch (magFilter) {
      case TextureFilter.MipMapLinearLinear:
      case TextureFilter.MipMapLinearNearest:
      case TextureFilter.MipMapNearestLinear:
      case TextureFilter.MipMapNearestNearest:
        return TextureFilter.Linear;
      default:
        return magFilter;
    }
  }

  setWraps(uWrap: TextureWrap, vWrap: TextureWrap) {
    let gl = this.context.gl;
    this.bind();
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, uWrap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, vWrap);
  }

  /**
   * 更新压缩纹理数据
   */
  update(useMipMaps: boolean) {
    let gl = this.context.gl;

    if (!this.texture) {
      this.texture = gl.createTexture();
    }

    if (!this.texture) {
      throw new Error('Failed to create WebGL texture');
    }

    this.bind();

    // 上传主纹理数据
    gl.compressedTexImage2D(
      gl.TEXTURE_2D,
      0, // mipmap level
      this.textureData.format,
      this.textureData.width,
      this.textureData.height,
      0, // border (must be 0)
      this.textureData.data
    );

    // 如果启用 mipmap 且有 mipmap 数据，上传所有 mipmap 层级
    if (useMipMaps && this.textureData.mipmaps && this.textureData.mipmaps.length > 0) {
      for (let i = 0; i < this.textureData.mipmaps.length; i++) {
        const mipmap = this.textureData.mipmaps[i];
        gl.compressedTexImage2D(
          gl.TEXTURE_2D,
          i + 1, // mipmap level
          this.textureData.format,
          mipmap.width,
          mipmap.height,
          0,
          mipmap.data
        );
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  restore() {
    this.texture = null;
    this.update(this.useMipMaps);
  }

  bind(unit: number = 0) {
    let gl = this.context.gl;
    this.boundUnit = unit;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  unbind() {
    let gl = this.context.gl;
    gl.activeTexture(gl.TEXTURE0 + this.boundUnit);
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  dispose() {
    this.context.removeRestorable(this);
    let gl = this.context.gl;
    gl.deleteTexture(this.texture);
  }

  /**
   * 获取纹理数据
   */
  getTextureData(): ASTCTextureData {
    return this.textureData;
  }

  /**
   * 更新纹理数据（用于动态更新压缩纹理）
   */
  updateTextureData(textureData: ASTCTextureData) {
    this.textureData = textureData;
    this.useMipMaps = textureData.mipmaps && textureData.mipmaps.length > 0 || false;
    this.update(this.useMipMaps);
  }
}
