/**
 * 图片处理工具函数集
 * 基于 Canvas API 纯前端本地处理
 * 支持：压缩、格式转换、尺寸调整、文字水印
 * 所有操作均在浏览器本地完成，不涉及后端服务器
 */

import { logger } from '@lark-apaas/client-toolkit-lite';

/* ============================================================
 *  类型定义
 * ============================================================ */

/** 支持的图片格式 */
export type ImageFormat = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/bmp' | 'image/gif';

/** 格式名称映射 */
export const FORMAT_NAMES: Record<ImageFormat, string> = {
  'image/jpeg': 'JPG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'image/bmp': 'BMP',
  'image/gif': 'GIF',
};

/** 水印位置（九宫格） */
export type WatermarkPosition =
  | 'top-left'
  | 'top-center'
  | 'top-right'
  | 'middle-left'
  | 'center'
  | 'middle-right'
  | 'bottom-left'
  | 'bottom-center'
  | 'bottom-right';

/** 图片文件信息 */
export interface ImageFileInfo {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  width: number;
  height: number;
  /** 加载后的 HTMLImageElement（用于处理） */
  img?: HTMLImageElement;
}

/** 压缩参数 */
export interface CompressOptions {
  /** 输出质量 0-1 */
  quality: number;
  /** 输出格式 */
  format: ImageFormat;
  /** 最大宽度（超出则等比缩放），0 表示不限制 */
  maxWidth?: number;
  /** 最大高度（超出则等比缩放），0 表示不限制 */
  maxHeight?: number;
}

/** 尺寸调整参数 */
export interface ResizeOptions {
  /** 调整模式：按像素 / 按百分比 */
  mode: 'pixel' | 'percent';
  /** 目标宽度（像素模式） */
  width?: number;
  /** 目标高度（像素模式） */
  height?: number;
  /** 百分比（百分比模式） */
  percent?: number;
  /** 是否锁定宽高比 */
  keepRatio: boolean;
}

/** 文字水印参数 */
export interface WatermarkOptions {
  /** 水印文字 */
  text: string;
  /** 字体大小（px） */
  fontSize: number;
  /** 字体 */
  fontFamily: string;
  /** 透明度 0-1 */
  opacity: number;
  /** 位置 */
  position: WatermarkPosition;
  /** 颜色（hex 或 rgb） */
  color: string;
  /** 水平边距（px） */
  marginX: number;
  /** 垂直边距（px） */
  marginY: number;
  /** 旋转角度（度） */
  rotation: number;
}

/** 处理结果 */
export interface ProcessResult {
  blob: Blob;
  fileName: string;
  width: number;
  height: number;
  size: number;
}

/* ============================================================
 *  工具函数
 * ============================================================ */

/**
 * 生成唯一 ID
 */
export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 从文件名提取扩展名
 */
export function getExtension(filename: string): string {
  const idx = filename.lastIndexOf('.');
  return idx >= 0 ? filename.slice(idx + 1).toLowerCase() : '';
}

/**
 * 根据扩展名获取 MIME 类型
 */
export function extToMime(ext: string): ImageFormat {
  const map: Record<string, ImageFormat> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    bmp: 'image/bmp',
    gif: 'image/gif',
  };
  return map[ext.toLowerCase()] || 'image/png';
}

/**
 * 从 MIME 转扩展名
 */
export function mimeToExt(mime: ImageFormat): string {
  const map: Record<ImageFormat, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/bmp': 'bmp',
    'image/gif': 'gif',
  };
  return map[mime] || 'png';
}

/* ============================================================
 *  图片加载
 * ============================================================ */

/**
 * 加载图片文件，获取宽高和 Image 对象
 */
export function loadImage(file: File): Promise<{ img: HTMLImageElement; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const { naturalWidth: width, naturalHeight: height } = img;
      resolve({ img, width, height });
      // 注意：不要在这里 revoke，后续处理还需要用
      // URL.revokeObjectURL(url);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

/**
 * 加载图片文件信息（含 ID 和元数据）
 */
export async function loadImageFileInfo(file: File): Promise<ImageFileInfo> {
  const { img, width, height } = await loadImage(file);
  return {
    id: genId(),
    file,
    name: file.name,
    originalSize: file.size,
    width,
    height,
    img,
  };
}

/**
 * 释放图片对象 URL
 */
export function releaseImage(info: ImageFileInfo) {
  if (info.img) {
    try {
      URL.revokeObjectURL(info.img.src);
    } catch {
      // ignore
    }
  }
}

/* ============================================================
 *  核心：Canvas 绘制 + 导出
 * ============================================================ */

/**
 * 在 Canvas 上绘制图片（支持缩放）
 * @returns 绘制后的 canvas
 */
export function drawImageOnCanvas(
  img: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');

  // 高质量缩放
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  return canvas;
}

/**
 * 将 Canvas 导出为 Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement, format: ImageFormat, quality: number = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('图片导出失败'));
        }
      },
      format,
      quality,
    );
  });
}

/* ============================================================
 *  功能 1：图片压缩
 * ============================================================ */

/**
 * 压缩单张图片
 * @param file 源图片文件
 * @param options 压缩选项
 * @param addWatermark 是否添加试用水印
 */
export async function compressImage(
  file: File,
  options: CompressOptions,
  addWatermark: boolean = false,
): Promise<ProcessResult> {
  const { img, width: origW, height: origH } = await loadImage(file);

  let targetW = origW;
  let targetH = origH;

  // 按最大宽高等比缩放
  if (options.maxWidth && options.maxWidth > 0 && origW > options.maxWidth) {
    const ratio = options.maxWidth / origW;
    targetW = options.maxWidth;
    targetH = Math.round(origH * ratio);
  }
  if (options.maxHeight && options.maxHeight > 0 && targetH > options.maxHeight) {
    const ratio = options.maxHeight / targetH;
    targetH = options.maxHeight;
    targetW = Math.round(targetW * ratio);
  }

  const canvas = drawImageOnCanvas(img, targetW, targetH);
  const ctx = canvas.getContext('2d');

  // 试用水印
  if (addWatermark && ctx) {
    addTrialWatermark(ctx, targetW, targetH);
  }

  const blob = await canvasToBlob(canvas, options.format, options.quality);

  // 释放
  try { URL.revokeObjectURL(img.src); } catch { /* ignore */ }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = mimeToExt(options.format);

  return {
    blob,
    fileName: `${baseName}_compressed.${ext}`,
    width: targetW,
    height: targetH,
    size: blob.size,
  };
}

/**
 * 批量压缩图片
 * @param files 图片文件数组
 * @param options 压缩选项
 * @param onProgress 进度回调 (0-100)
 * @param addWatermark 是否加水印
 */
export async function batchCompress(
  files: File[],
  options: CompressOptions,
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const result = await compressImage(files[i], options, addWatermark);
    results.push(result);
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  return results;
}

/* ============================================================
 *  功能 2：格式转换
 * ============================================================ */

/**
 * 转换单张图片格式
 */
export async function convertFormat(
  file: File,
  targetFormat: ImageFormat,
  quality: number = 0.95,
  addWatermark: boolean = false,
): Promise<ProcessResult> {
  const { img, width, height } = await loadImage(file);
  const canvas = drawImageOnCanvas(img, width, height);
  const ctx = canvas.getContext('2d');

  if (addWatermark && ctx) {
    addTrialWatermark(ctx, width, height);
  }

  const blob = await canvasToBlob(canvas, targetFormat, quality);

  try { URL.revokeObjectURL(img.src); } catch { /* ignore */ }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = mimeToExt(targetFormat);

  return {
    blob,
    fileName: `${baseName}.${ext}`,
    width,
    height,
    size: blob.size,
  };
}

/**
 * 批量格式转换
 */
export async function batchConvertFormat(
  files: File[],
  targetFormat: ImageFormat,
  quality: number = 0.95,
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const result = await convertFormat(files[i], targetFormat, quality, addWatermark);
    results.push(result);
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  return results;
}

/* ============================================================
 *  功能 3：尺寸调整
 * ============================================================ */

/**
 * 计算调整后的尺寸
 */
export function calcResizeDimensions(
  origWidth: number,
  origHeight: number,
  options: ResizeOptions,
): { width: number; height: number } {
  if (options.mode === 'percent') {
    const pct = (options.percent ?? 100) / 100;
    return {
      width: Math.max(1, Math.round(origWidth * pct)),
      height: Math.max(1, Math.round(origHeight * pct)),
    };
  }

  // pixel 模式
  let w = options.width ?? origWidth;
  let h = options.height ?? origHeight;

  if (options.keepRatio) {
    if (options.width && !options.height) {
      h = Math.round(origHeight * (w / origWidth));
    } else if (options.height && !options.width) {
      w = Math.round(origWidth * (h / origHeight));
    } else if (options.width && options.height) {
      // 两者都给了但锁定比例，按较小比例缩放
      const ratioW = w / origWidth;
      const ratioH = h / origHeight;
      const ratio = Math.min(ratioW, ratioH);
      w = Math.round(origWidth * ratio);
      h = Math.round(origHeight * ratio);
    }
  }

  return {
    width: Math.max(1, w),
    height: Math.max(1, h),
  };
}

/**
 * 调整单张图片尺寸
 */
export async function resizeImage(
  file: File,
  options: ResizeOptions,
  outputFormat?: ImageFormat,
  quality: number = 0.95,
  addWatermark: boolean = false,
): Promise<ProcessResult> {
  const { img, width: origW, height: origH } = await loadImage(file);
  const { width, height } = calcResizeDimensions(origW, origH, options);

  const canvas = drawImageOnCanvas(img, width, height);
  const ctx = canvas.getContext('2d');

  if (addWatermark && ctx) {
    addTrialWatermark(ctx, width, height);
  }

  const format = outputFormat || extToMime(getExtension(file.name));
  const blob = await canvasToBlob(canvas, format, quality);

  try { URL.revokeObjectURL(img.src); } catch { /* ignore */ }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = mimeToExt(format);

  return {
    blob,
    fileName: `${baseName}_${width}x${height}.${ext}`,
    width,
    height,
    size: blob.size,
  };
}

/**
 * 批量调整尺寸
 */
export async function batchResize(
  files: File[],
  options: ResizeOptions,
  outputFormat?: ImageFormat,
  quality: number = 0.95,
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const result = await resizeImage(files[i], options, outputFormat, quality, addWatermark);
    results.push(result);
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  return results;
}

/* ============================================================
 *  功能 4：文字水印
 * ============================================================ */

/**
 * 计算水印文字的绘制坐标
 */
export function calcWatermarkPosition(
  canvasWidth: number,
  canvasHeight: number,
  textWidth: number,
  textHeight: number,
  position: WatermarkPosition,
  marginX: number,
  marginY: number,
): { x: number; y: number } {
  let x = marginX;
  let y = marginY;

  switch (position) {
    case 'top-left':
      x = marginX;
      y = marginY + textHeight;
      break;
    case 'top-center':
      x = (canvasWidth - textWidth) / 2;
      y = marginY + textHeight;
      break;
    case 'top-right':
      x = canvasWidth - marginX - textWidth;
      y = marginY + textHeight;
      break;
    case 'middle-left':
      x = marginX;
      y = (canvasHeight + textHeight) / 2;
      break;
    case 'center':
      x = (canvasWidth - textWidth) / 2;
      y = (canvasHeight + textHeight) / 2;
      break;
    case 'middle-right':
      x = canvasWidth - marginX - textWidth;
      y = (canvasHeight + textHeight) / 2;
      break;
    case 'bottom-left':
      x = marginX;
      y = canvasHeight - marginY;
      break;
    case 'bottom-center':
      x = (canvasWidth - textWidth) / 2;
      y = canvasHeight - marginY;
      break;
    case 'bottom-right':
      x = canvasWidth - marginX - textWidth;
      y = canvasHeight - marginY;
      break;
  }

  return { x, y };
}

/**
 * 给单张图片添加文字水印
 */
export async function addWatermark(
  file: File,
  options: WatermarkOptions,
  outputFormat?: ImageFormat,
  quality: number = 0.95,
  addTrial: boolean = false,
): Promise<ProcessResult> {
  const { img, width, height } = await loadImage(file);
  const canvas = drawImageOnCanvas(img, width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');

  // 设置水印样式
  ctx.save();
  ctx.globalAlpha = options.opacity;
  ctx.font = `${options.fontSize}px ${options.fontFamily}`;
  ctx.fillStyle = options.color;
  ctx.textBaseline = 'alphabetic';

  const textMetrics = ctx.measureText(options.text);
  const textWidth = textMetrics.width;
  const textHeight = options.fontSize;

  const { x, y } = calcWatermarkPosition(
    width,
    height,
    textWidth,
    textHeight,
    options.position,
    options.marginX,
    options.marginY,
  );

  // 旋转（围绕文字中心点）
  if (options.rotation !== 0) {
    const centerX = x + textWidth / 2;
    const centerY = y - textHeight / 2;
    ctx.translate(centerX, centerY);
    ctx.rotate((options.rotation * Math.PI) / 180);
    ctx.translate(-centerX, -centerY);
  }

  ctx.fillText(options.text, x, y);
  ctx.restore();

  // 试用版额外水印
  if (addTrial) {
    addTrialWatermark(ctx, width, height);
  }

  const format = outputFormat || extToMime(getExtension(file.name));
  const blob = await canvasToBlob(canvas, format, quality);

  try { URL.revokeObjectURL(img.src); } catch { /* ignore */ }

  const baseName = file.name.replace(/\.[^.]+$/, '');
  const ext = mimeToExt(format);

  return {
    blob,
    fileName: `${baseName}_watermarked.${ext}`,
    width,
    height,
    size: blob.size,
  };
}

/**
 * 批量添加文字水印
 */
export async function batchAddWatermark(
  files: File[],
  options: WatermarkOptions,
  outputFormat?: ImageFormat,
  quality: number = 0.95,
  onProgress?: (percent: number) => void,
  addTrial: boolean = false,
): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const result = await addWatermark(files[i], options, outputFormat, quality, addTrial);
    results.push(result);
    if (onProgress) {
      onProgress(Math.round(((i + 1) / total) * 100));
    }
  }

  return results;
}

/* ============================================================
 *  试用水印
 * ============================================================ */

/**
 * 添加试用水印（斜纹平铺）
 */
export function addTrialWatermark(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.font = 'bold 28px sans-serif';
  ctx.fillStyle = '#999999';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const text = '试用版';
  const stepX = 180;
  const stepY = 120;

  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);

  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      ctx.fillText(text, x, y);
    }
  }

  ctx.restore();
}

/* ============================================================
 *  文件下载工具
 * ============================================================ */

/**
 * 下载单个文件
 */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 批量下载（逐个触发）
 */
export function downloadBatch(results: ProcessResult[]) {
  results.forEach((r, i) => {
    setTimeout(() => downloadBlob(r.blob, r.fileName), i * 300);
  });
}

/**
 * 估算压缩后大小（粗略）
 */
export function estimateCompressedSize(
  originalSize: number,
  quality: number,
  targetFormat: ImageFormat,
): number {
  // 粗略估算：PNG 无损、JPEG/WebP 按质量比例
  const baseRatio = targetFormat === 'image/png' ? 0.9 : quality * 0.8 + 0.1;
  return Math.round(originalSize * baseRatio);
}

logger.info('image-processor utils loaded');
