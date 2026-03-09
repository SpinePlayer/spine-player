import { IBound } from '../type';

/**
 * 获取随机uuid
 */
export function getRandomUUID() {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 11);
  return `${timestamp}_${randomPart}`;
}

/**
 * 将viewport单位的边界转换为px
 */
export function viewportBound(bound: IBound, viewportWidth: number) {
  const scale = (value: number) => value / viewportWidth * window.innerWidth;
  return {
    x: scale(bound.x),
    y: scale(bound.y),
    width: scale(bound.width),
    height: scale(bound.height),
  };
}

/**
 * 将rem单位的边界转换为px
 */
export function remBound(bound: IBound, rootValue: number): IBound {
  const fontSize = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const scale = (value: number) => value / rootValue * fontSize;
  return {
    x: scale(bound.x),
    y: scale(bound.y),
    width: scale(bound.width),
    height: scale(bound.height),
  };
}

/**
 * 画布文字折行
 */
export function drawWrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  // 先按 \n 分割处理强制换行
  const lines = text.split('\n');
  let offsetY = 0;

  for (const line of lines) {
    let currentLine = '';

    for (let i = 0; i < line.length; i++) {
      const testLine = currentLine + line[i];
      const metrics = context.measureText(testLine);
      const testWidth = metrics.width;

      if (testWidth > maxWidth && currentLine !== '') {
        context.fillText(currentLine, x, y + offsetY);
        currentLine = line[i];
        offsetY += lineHeight;
      } else {
        currentLine = testLine;
      }
    }
    
    // 绘制当前行的剩余内容
    if (currentLine) {
      context.fillText(currentLine, x, y + offsetY);
      offsetY += lineHeight;
    }
  }
}

/**
 * 文字转图片
 */
export interface IFontConfig {
  width?: number;
  height?: number;
  lineHeight?: number;
  fontSize?: number;
  fontWeight?: number | string;
  color?: string;
  textBaseline?: CanvasTextBaseline;
  textAlign?: CanvasTextAlign;
  fontFamily?: string;
  shadow?: {
    color?: string;
    blur?: number;
    offsetX?: number;
    offsetY?: number;
  }
}
export function getTextImage(
  text: string,
  config: IFontConfig = <IFontConfig>{},
) {
  try {
    // 初始化配置
    config.width = config.width || 120;
    config.height = config.height || 32;
    config.fontSize = config.fontSize || 28;
    config.fontWeight = config.fontWeight || 400;
    config.lineHeight = config.lineHeight || 32;
    config.fontFamily = config.fontFamily || 'PingFang SC';
    config.textAlign = config.textAlign || 'center';
    config.textBaseline = config.textBaseline || 'middle';
    // config.verticalAligin = config.verticalAligin || 'center';
    config.color = config.color || '#000000';
    // 创建canvas
    const fontCanvas = document.createElement('canvas');
    const ratio = window.devicePixelRatio || 2;
    fontCanvas.width = config.width * ratio; // resize
    fontCanvas.height = config.height * ratio;
    const fontContext = fontCanvas.getContext(
      '2d',
    ) as CanvasRenderingContext2D;
    // 设置字体
    const fontSize = config.fontSize * ratio;
    const fontWeight = config.fontWeight;
    const lineHeight = config.lineHeight * ratio;
    fontContext.font = `${fontWeight} ${fontSize}px ${config.fontFamily || 'PingFang SC'}, Arial`;
    fontContext.textAlign = config.textAlign;
    fontContext.textBaseline = config.textBaseline;
    fontContext.fillStyle = config.color;
    // shadow
    if (config.shadow) {
      fontContext.shadowColor = config.shadow?.color || 'rgba(0, 0, 0, 0.5)';
      fontContext.shadowBlur = config.shadow?.blur || 6;
      fontContext.shadowOffsetX = config.shadow?.offsetX || 0;
      fontContext.shadowOffsetY = config.shadow?.offsetY || 0;
    }
    const getOffsetY = () => {
      if (config.textBaseline === 'top') {
        return 0;
      }
      if (config.textBaseline === 'middle') {
        return lineHeight / 2;
      }
      return lineHeight;
    }
    const getOffsetX = () => {
      if (config.textAlign === 'right') {
        return fontCanvas.width;
      }
      if (config.textAlign === 'center') {
        return fontCanvas.width / 2;
      }
      return 0;
    }
    // 绘制文字
    drawWrappedText(
      fontContext,
      text,
      getOffsetX(),
      getOffsetY(),
      fontCanvas.width,
      lineHeight,
    );
    return fontCanvas.toDataURL();
  } catch (error) {
    console.error(error);
    return '';
  }
}

/**
 * 解析颜色字符串为 RGBA 值
 */
export function parseColor(color: string): { r: number; g: number; b: number; a: number } {
  // 默认透明
  let r = 0, g = 0, b = 0, a = 0;

  if (!color) return { r, g, b, a };

  try {
    // 处理 hex 颜色 (#rgb, #rrggbb, #rrggbbaa)
    if (color.startsWith('#')) {
      const hex = color.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16) / 255;
        g = parseInt(hex[1] + hex[1], 16) / 255;
        b = parseInt(hex[2] + hex[2], 16) / 255;
        a = 1;
      } else if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16) / 255;
        g = parseInt(hex.slice(2, 4), 16) / 255;
        b = parseInt(hex.slice(4, 6), 16) / 255;
        a = 1;
      } else if (hex.length === 8) {
        r = parseInt(hex.slice(0, 2), 16) / 255;
        g = parseInt(hex.slice(2, 4), 16) / 255;
        b = parseInt(hex.slice(4, 6), 16) / 255;
        a = parseInt(hex.slice(6, 8), 16) / 255;
      }
    }
    // 处理 rgb/rgba 颜色
    else if (color.startsWith('rgb')) {
      // 使用更精确的正则表达式匹配 rgb/rgba 值
      // 匹配格式：rgb(255, 0, 0) 或 rgba(255, 0, 0, 0.5)
      const rgbMatch = color.match(/rgba?\(([^)]+)\)/);
      if (rgbMatch && rgbMatch[1]) {
        // 分割并去除空格
        const values = rgbMatch[1].split(',').map(v => v.trim());
        if (values.length >= 3) {
          r = parseFloat(values[0]) / 255;
          g = parseFloat(values[1]) / 255;
          b = parseFloat(values[2]) / 255;
          // alpha 值已经是 0-1 范围，不需要除以 255
          a = values.length >= 4 ? parseFloat(values[3]) : 1;
        }
      }
    }
  } catch (error) {
    console.error('解析颜色字符串为 RGBA 值失败:', error);
  }

  return { r, g, b, a };
}

/**
 * 检查文件扩展名
 */
export function checkExtension(url: string, extension: string) {
  return url.split('?')[0]?.toLowerCase().endsWith(extension.toLowerCase());
}
