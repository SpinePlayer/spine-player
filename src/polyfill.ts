/**
 * ImageBitmap 和 createImageBitmap polyfill for iOS low versions
 */

if (typeof globalThis === 'undefined') {
  (function() {
    if (typeof self !== 'undefined') {
      (self as any).globalThis = self;
    } else if (typeof window !== 'undefined') {
      (window as any).globalThis = window;
    } else if (typeof global !== 'undefined') {
      (global as any).globalThis = global;
    } else {
      throw new Error('Unable to locate global object');
    }
  })();
}

// 检查是否支持 ImageBitmap
if (typeof ImageBitmap === 'undefined') {
  // 创建一个简单的 ImageBitmap 类
  class ImageBitmapPolyfill {
    public width: number;
    public height: number;
    public closed: boolean = false;
    private canvas: HTMLCanvasElement;
    private context: CanvasRenderingContext2D;

    constructor(canvas: HTMLCanvasElement, width?: number, height?: number) {
      this.canvas = canvas;
      this.width = width || canvas.width;
      this.height = height || canvas.height;
      this.context = canvas.getContext('2d')!;
    }

    close(): void {
      this.closed = true;
    }
  }

  // 将 ImageBitmapPolyfill 赋值给全局 ImageBitmap
  (globalThis as any).ImageBitmap = ImageBitmapPolyfill;
}

// 检查是否支持 createImageBitmap
if (typeof createImageBitmap === 'undefined') {
  // 创建 createImageBitmap polyfill
  const createImageBitmapPolyfill = async (
    image: HTMLImageElement | HTMLCanvasElement | HTMLVideoElement | ImageData | Blob | ImageBitmap,
    sx?: number,
    sy?: number,
    sw?: number,
    sh?: number
  ): Promise<ImageBitmap> => {
    return new Promise((resolve, reject) => {
      try {
        let canvas: HTMLCanvasElement;
        let context: CanvasRenderingContext2D;
        let sourceWidth: number;
        let sourceHeight: number;

        // 处理不同类型的输入
        if (image instanceof HTMLImageElement) {
          canvas = document.createElement('canvas');
          context = canvas.getContext('2d')!;
          sourceWidth = image.naturalWidth;
          sourceHeight = image.naturalHeight;
          
          // 设置canvas尺寸
          canvas.width = sw || sourceWidth;
          canvas.height = sh || sourceHeight;
          
          // 绘制图片
          context.drawImage(
            image,
            sx || 0,
            sy || 0,
            sw || sourceWidth,
            sh || sourceHeight,
            0,
            0,
            sw || sourceWidth,
            sh || sourceHeight
          );
        } else if (image instanceof HTMLCanvasElement) {
          canvas = document.createElement('canvas');
          context = canvas.getContext('2d')!;
          sourceWidth = image.width;
          sourceHeight = image.height;
          
          // 设置canvas尺寸
          canvas.width = sw || sourceWidth;
          canvas.height = sh || sourceHeight;
          
          // 绘制canvas
          context.drawImage(
            image,
            sx || 0,
            sy || 0,
            sw || sourceWidth,
            sh || sourceHeight,
            0,
            0,
            sw || sourceWidth,
            sh || sourceHeight
          );
        } else if (image instanceof HTMLVideoElement) {
          canvas = document.createElement('canvas');
          context = canvas.getContext('2d')!;
          sourceWidth = image.videoWidth;
          sourceHeight = image.videoHeight;
          
          // 设置canvas尺寸
          canvas.width = sw || sourceWidth;
          canvas.height = sh || sourceHeight;
          
          // 绘制视频帧
          context.drawImage(
            image,
            sx || 0,
            sy || 0,
            sw || sourceWidth,
            sh || sourceHeight,
            0,
            0,
            sw || sourceWidth,
            sh || sourceHeight
          );
        } else if (image instanceof ImageData) {
          canvas = document.createElement('canvas');
          context = canvas.getContext('2d')!;
          sourceWidth = image.width;
          sourceHeight = image.height;
          
          // 设置canvas尺寸
          canvas.width = sw || sourceWidth;
          canvas.height = sh || sourceHeight;
          
          // 处理裁剪
          if (sx !== undefined && sy !== undefined && sw !== undefined && sh !== undefined) {
            const croppedImageData = new ImageData(sw, sh);
            const sourceData = image.data;
            const targetData = croppedImageData.data;
            
            for (let y = 0; y < sh; y++) {
              for (let x = 0; x < sw; x++) {
                const sourceIndex = ((sy + y) * sourceWidth + (sx + x)) * 4;
                const targetIndex = (y * sw + x) * 4;
                
                targetData[targetIndex] = sourceData[sourceIndex];
                targetData[targetIndex + 1] = sourceData[sourceIndex + 1];
                targetData[targetIndex + 2] = sourceData[sourceIndex + 2];
                targetData[targetIndex + 3] = sourceData[sourceIndex + 3];
              }
            }
            context.putImageData(croppedImageData, 0, 0);
          } else {
            context.putImageData(image, 0, 0);
          }
        } else if (image instanceof Blob) {
          // 对于Blob，需要先转换为图片
          const img = new Image();
          const url = URL.createObjectURL(image);
          
          img.onload = () => {
            canvas = document.createElement('canvas');
            context = canvas.getContext('2d')!;
            sourceWidth = img.naturalWidth;
            sourceHeight = img.naturalHeight;
            
            // 设置canvas尺寸
            canvas.width = sw || sourceWidth;
            canvas.height = sh || sourceHeight;
            
            // 绘制图片
            context.drawImage(
              img,
              sx || 0,
              sy || 0,
              sw || sourceWidth,
              sh || sourceHeight,
              0,
              0,
              sw || sourceWidth,
              sh || sourceHeight
            );
            
            URL.revokeObjectURL(url);
            resolve(new (globalThis as any).ImageBitmap(canvas, sw || sourceWidth, sh || sourceHeight));
          };
          
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Failed to load image from blob'));
          };
          
          img.src = url;
          return; // 异步处理，直接返回
        } else if (image instanceof ImageBitmap) {
          // 如果已经是ImageBitmap，直接返回
          resolve(image);
          return;
        } else {
          reject(new Error('Unsupported image type'));
          return;
        }

        // 创建ImageBitmap实例
        const imageBitmap = new (globalThis as any).ImageBitmap(canvas, sw || sourceWidth, sh || sourceHeight);
        resolve(imageBitmap);
      } catch (error) {
        reject(error);
      }
    });
  };

  // 将 polyfill 赋值给全局 createImageBitmap
  (globalThis as any).createImageBitmap = createImageBitmapPolyfill;
}

// 导出polyfill函数，供其他地方使用
export const applyImageBitmapPolyfill = () => {
  // polyfill已经在上面的代码中自动应用
  console.log('ImageBitmap polyfill applied');
};

// 检查polyfill是否已应用
export const isImageBitmapSupported = (): boolean => {
  return typeof ImageBitmap !== 'undefined' && typeof createImageBitmap !== 'undefined';
};