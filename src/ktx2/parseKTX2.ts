/**
 * KTX2 文件头结构
 * 参考：https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html
 */
interface KTX2Header {
  identifier: Uint8Array;
  vkFormat: number;
  typeSize: number;
  pixelWidth: number;
  pixelHeight: number;
  pixelDepth: number;
  layerCount: number;
  faceCount: number;
  levelCount: number;
  supercompressionScheme: number;
  // Index
  dfdByteOffset: number;
  dfdByteLength: number;
  kvdByteOffset: number;
  kvdByteLength: number;
  sgdByteOffset: bigint;
  sgdByteLength: bigint;
}

interface KTX2LevelIndex {
  byteOffset: bigint;
  byteLength: bigint;
  uncompressedByteLength: bigint;
}

export interface KTX2ParsedData {
  header: KTX2Header;
  levels: Uint8Array[];  // 每个 mipmap level 的 ASTC 数据
  vkFormat: number;
  glInternalFormat: number;
}

// 导入 GLTextureASTC 的类型
import type { ASTCTextureData, ASTCFormat } from './GLTextureASTC';

/**
 * 完整的 ASTC Vulkan 到 WebGL 格式映射
 */
export const VK_ASTC_TO_GL_FORMAT: Record<number, { gl: number; name: string }> = {
  // 4x4
  157: { gl: 0x93B0, name: 'COMPRESSED_RGBA_ASTC_4x4_KHR' },
  158: { gl: 0x93D0, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR' },
  // 5x4
  159: { gl: 0x93B1, name: 'COMPRESSED_RGBA_ASTC_5x4_KHR' },
  160: { gl: 0x93D1, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR' },
  // 5x5
  161: { gl: 0x93B2, name: 'COMPRESSED_RGBA_ASTC_5x5_KHR' },
  162: { gl: 0x93D2, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR' },
  // 6x5
  163: { gl: 0x93B3, name: 'COMPRESSED_RGBA_ASTC_6x5_KHR' },
  164: { gl: 0x93D3, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR' },
  // 6x6
  165: { gl: 0x93B4, name: 'COMPRESSED_RGBA_ASTC_6x6_KHR' },
  166: { gl: 0x93D4, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR' },
  // 8x5
  167: { gl: 0x93B5, name: 'COMPRESSED_RGBA_ASTC_8x5_KHR' },
  168: { gl: 0x93D5, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR' },
  // 8x6
  169: { gl: 0x93B6, name: 'COMPRESSED_RGBA_ASTC_8x6_KHR' },
  170: { gl: 0x93D6, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR' },
  // 8x8
  171: { gl: 0x93B7, name: 'COMPRESSED_RGBA_ASTC_8x8_KHR' },
  172: { gl: 0x93D7, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR' },
  // 10x5
  173: { gl: 0x93B8, name: 'COMPRESSED_RGBA_ASTC_10x5_KHR' },
  174: { gl: 0x93D8, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR' },
  // 10x6
  175: { gl: 0x93B9, name: 'COMPRESSED_RGBA_ASTC_10x6_KHR' },
  176: { gl: 0x93D9, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR' },
  // 10x8
  177: { gl: 0x93BA, name: 'COMPRESSED_RGBA_ASTC_10x8_KHR' },
  178: { gl: 0x93DA, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR' },
  // 10x10
  179: { gl: 0x93BB, name: 'COMPRESSED_RGBA_ASTC_10x10_KHR' },
  180: { gl: 0x93DB, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR' },
  // 12x10
  181: { gl: 0x93BC, name: 'COMPRESSED_RGBA_ASTC_12x10_KHR' },
  182: { gl: 0x93DC, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR' },
  // 12x12
  183: { gl: 0x93BD, name: 'COMPRESSED_RGBA_ASTC_12x12_KHR' },
  184: { gl: 0x93DD, name: 'COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR' },
};

/**
 * KTX2 解析器（仅支持未压缩的 ASTC）
 */
export class KTX2Parser {
  private static KTX2_IDENTIFIER = new Uint8Array([
    0xAB, 0x4B, 0x54, 0x58, 0x20, 0x32, 0x30, 0xBB, 0x0D, 0x0A, 0x1A, 0x0A
  ]);

  /**
   * 解析 KTX2 文件
   */
  static parse(arrayBuffer: ArrayBuffer, options?: { forceLinear?: boolean }): KTX2ParsedData {
    const dataView = new DataView(arrayBuffer);
    let offset = 0;

    // 1. 验证文件标识
    const identifier = new Uint8Array(arrayBuffer, 0, 12);
    if (!this.validateIdentifier(identifier)) {
      throw new Error('Invalid KTX2 file: wrong identifier');
    }
    offset += 12;

    // 2. 读取文件头（80 字节）
    const header: KTX2Header = {
      identifier,
      vkFormat: dataView.getUint32(offset, true), // little-endian
      typeSize: dataView.getUint32(offset + 4, true),
      pixelWidth: dataView.getUint32(offset + 8, true),
      pixelHeight: dataView.getUint32(offset + 12, true),
      pixelDepth: dataView.getUint32(offset + 16, true),
      layerCount: dataView.getUint32(offset + 20, true),
      faceCount: dataView.getUint32(offset + 24, true),
      levelCount: dataView.getUint32(offset + 28, true),
      supercompressionScheme: dataView.getUint32(offset + 32, true),
      dfdByteOffset: dataView.getUint32(offset + 36, true),
      dfdByteLength: dataView.getUint32(offset + 40, true),
      kvdByteOffset: dataView.getUint32(offset + 44, true),
      kvdByteLength: dataView.getUint32(offset + 48, true),
      sgdByteOffset: dataView.getBigUint64(offset + 52, true),
      sgdByteLength: dataView.getBigUint64(offset + 60, true),
    };
    offset += 68;

    // 验证：必须是未压缩的（supercompressionScheme = 0）
    if (header.supercompressionScheme !== 0) {
      throw new Error('Supercompressed KTX2 not supported in lightweight parser');
    }

    // 3. 读取 Level Index（每个 level 24 字节）
    const levelCount = Math.max(1, header.levelCount);
    const levelIndex: KTX2LevelIndex[] = [];

    for (let i = 0; i < levelCount; i++) {
      levelIndex.push({
        byteOffset: dataView.getBigUint64(offset, true),
        byteLength: dataView.getBigUint64(offset + 8, true),
        uncompressedByteLength: dataView.getBigUint64(offset + 16, true),
      });
      offset += 24;
    }

    // 4. 跳过 DFD 和 KVD（只需要图像数据）
    // 直接跳到图像数据部分

    // 5. 提取每个 mipmap level 的数据
    const levels: Uint8Array[] = [];

    for (let i = 0; i < levelCount; i++) {
      const levelOffset = Number(levelIndex[i].byteOffset);
      const levelLength = Number(levelIndex[i].byteLength);

      const levelData = new Uint8Array(
        arrayBuffer,
        levelOffset,
        levelLength
      );

      levels.push(levelData);
    }

    // 6. 映射 Vulkan 格式到 WebGL 格式
    let vkFormat = header.vkFormat;
    // 默认强制使用 Linear 格式，避免 WebGL 自动 sRGB 解码
    if (options?.forceLinear !== false) {
      const originalFormat = vkFormat;
      vkFormat = this.convertToLinearFormat(vkFormat);
      if (originalFormat !== vkFormat) {
        console.log(`[KTX2] Converting sRGB format ${originalFormat} to Linear format ${vkFormat}`);
      }
    }

    const glInternalFormat = this.vkFormatToGLFormat(vkFormat);

    return {
      header,
      levels,
      vkFormat,
      glInternalFormat,
    };
  }

  /**
   * 验证 KTX2 文件标识
   */
  private static validateIdentifier(identifier: Uint8Array): boolean {
    if (identifier.length !== this.KTX2_IDENTIFIER.length) return false;

    for (let i = 0; i < identifier.length; i++) {
      if (identifier[i] !== this.KTX2_IDENTIFIER[i]) return false;
    }

    return true;
  }

  /**
   * 将 sRGB ASTC 格式转换为对应的 Linear 格式
   * 这样可以避免 WebGL 自动进行 sRGB -> Linear 转换
   */
  private static convertToLinearFormat(vkFormat: number): number {
    if (vkFormat >= 158 && vkFormat <= 184 && vkFormat % 2 === 0) {
      return vkFormat - 1; // 转换为对应的 Linear 格式
    }
    return vkFormat;
  }

  /**
   * Vulkan 格式转 WebGL 格式
   * 参考：https://registry.khronos.org/vulkan/specs/1.3/html/vkspec.html#VkFormat
   */
  private static vkFormatToGLFormat(vkFormat: number): number {
    const glFormat = VK_ASTC_TO_GL_FORMAT[vkFormat];

    if (!glFormat) {
      throw new Error(`Unsupported VK format: ${vkFormat}`);
    }

    return glFormat.gl;
  }

  /**
   * 将 KTX2 解析数据转换为 GLTextureASTC 所需的 ASTCTextureData 格式
   * @param parsedData KTX2 解析后的数据
   * @returns ASTCTextureData 格式的纹理数据
   */
  static toASTCTextureData(parsedData: KTX2ParsedData): ASTCTextureData {
    const { header, levels, glInternalFormat } = parsedData;

    // 主纹理数据（第一个 level）
    const mainLevel = levels[0];

    // 计算每个 mipmap 层级的尺寸
    const mipmaps: Array<{
      data: Uint8Array;
      width: number;
      height: number;
    }> = [];

    // 如果有多个 level，则处理 mipmap
    if (levels.length > 1) {
      for (let i = 1; i < levels.length; i++) {
        const mipWidth = Math.max(1, header.pixelWidth >> i);
        const mipHeight = Math.max(1, header.pixelHeight >> i);

        mipmaps.push({
          data: levels[i],
          width: mipWidth,
          height: mipHeight,
        });
      }
    }

    return {
      data: mainLevel,
      width: header.pixelWidth,
      height: header.pixelHeight,
      format: glInternalFormat as ASTCFormat,
      mipmaps: mipmaps.length > 0 ? mipmaps : undefined,
    };
  }

  /**
   * 解析 KTX2 文件并转换为 ASTCTextureData
   * @param arrayBuffer KTX2 文件的 ArrayBuffer
   * @returns ASTCTextureData 格式的纹理数据
   */
  static parseToASTCTextureData(arrayBuffer: ArrayBuffer): ASTCTextureData {
    const parsedData = this.parse(arrayBuffer);
    console.log('VK Format:', parsedData.vkFormat);
    console.log('GL Format:', parsedData.glInternalFormat.toString(16));
    console.log('Format name:', VK_ASTC_TO_GL_FORMAT[parsedData.vkFormat]?.name);
    return this.toASTCTextureData(parsedData);
  }
}
