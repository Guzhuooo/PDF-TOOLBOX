/**
 * 二维码处理工具函数集
 * 基于 qrcode + jsqr + Canvas API，所有操作均在浏览器本地完成，不涉及后端服务器
 * 支持：生成（文本/URL/WiFi/名片）、识别、美化（圆点/方块/液态）、Logo、渐变色、批量生成
 */

import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { logger } from '@lark-apaas/client-toolkit-lite';

/* ============================================================
 *  类型定义
 * ============================================================ */

/** 容错级别 */
export type QrErrorLevel = 'L' | 'M' | 'Q' | 'H';

/** 二维码样式模板 */
export type QrStyle = 'classic' | 'dots' | 'squares' | 'liquid';

/** 定位点样式 */
export type FinderPatternStyle = 'square' | 'rounded' | 'circle';

/** 生成配置 */
export interface QrGenerateConfig {
  /** 内容文本 */
  content: string;
  /** 尺寸（像素） */
  size: number;
  /** 容错级别 */
  errorLevel: QrErrorLevel;
  /** 前景色 */
  foreground: string;
  /** 背景色 */
  background: string;
  /** 内边距（模块数） */
  margin: number;
  /** 样式模板 */
  style: QrStyle;
  /** 是否使用渐变色 */
  useGradient: boolean;
  /** 渐变起始色 */
  gradientStart: string;
  /** 渐变结束色 */
  gradientEnd: string;
  /** 渐变角度（度） */
  gradientAngle: number;
  /** 定位点样式 */
  finderPattern: FinderPatternStyle;
  /** 定位点颜色 */
  finderColor: string;
  /** Logo 图片（可选） */
  logoImage?: HTMLImageElement | null;
  /** Logo 占比（0-1） */
  logoRatio: number;
  /** Logo 背景圆角 */
  logoRadius: number;
  /** Logo 背景色 */
  logoBgColor: string;
  /** 是否添加水印（试用版） */
  addWatermark?: boolean;
  /** 水印文字 */
  watermarkText?: string;
}

/** 生成结果 */
export interface QrGenerateResult {
  /** Canvas 元素 */
  canvas: HTMLCanvasElement;
  /** PNG 数据 URL */
  dataUrl: string;
  /** 原始二维码模块数据 */
  modules: boolean[][];
  /** 模块数量（边长） */
  moduleCount: number;
}

/** 识别结果 */
export interface QrDecodeResult {
  /** 识别到的内容 */
  text: string;
  /** 是否成功 */
  success: boolean;
  /** 错误信息 */
  error?: string;
  /** 原始文件名 */
  fileName?: string;
}

/** 批量生成项 */
export interface QrBatchItem {
  /** 内容 */
  content: string;
  /** 文件名（不含扩展名） */
  fileName: string;
  /** 生成结果 */
  result?: QrGenerateResult;
  /** 错误信息 */
  error?: string;
}

/** 内容类型 */
export type QrContentType = 'text' | 'url' | 'wifi' | 'vcard' | 'email' | 'sms' | 'phone';

/** WiFi 配置 */
export interface WifiConfig {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden?: boolean;
}

/** 名片配置 */
export interface VCardConfig {
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  title?: string;
  url?: string;
  address?: string;
}

/* ============================================================
 *  内容格式化工具
 * ============================================================ */

/**
 * 生成 WiFi 二维码内容字符串
 */
export function formatWifiContent(config: WifiConfig): string {
  const { ssid, password, encryption, hidden = false } = config;
  const escape = (s: string) => s.replace(/([\\;,:"])/g, '\\$1');
  let result = `WIFI:T:${encryption};S:${escape(ssid)};`;
  if (encryption !== 'nopass' && password) {
    result += `P:${escape(password)};`;
  }
  if (hidden) {
    result += 'H:true;';
  }
  result += ';';
  return result;
}

/**
 * 生成 vCard 名片内容字符串
 */
export function formatVCardContent(config: VCardConfig): string {
  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${config.name}`,
  ];
  if (config.phone) lines.push(`TEL:${config.phone}`);
  if (config.email) lines.push(`EMAIL:${config.email}`);
  if (config.company) lines.push(`ORG:${config.company}`);
  if (config.title) lines.push(`TITLE:${config.title}`);
  if (config.url) lines.push(`URL:${config.url}`);
  if (config.address) lines.push(`ADR:;;${config.address};;;;`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

/**
 * 根据类型和参数生成二维码内容
 */
export function generateContentByType(
  type: QrContentType,
  params: Record<string, string>,
): string {
  switch (type) {
    case 'text':
      return params.text || '';
    case 'url':
      return params.url || '';
    case 'wifi':
      return formatWifiContent({
        ssid: params.ssid || '',
        password: params.password || '',
        encryption: (params.encryption as WifiConfig['encryption']) || 'WPA',
        hidden: params.hidden === 'true',
      });
    case 'vcard':
      return formatVCardContent({
        name: params.name || '',
        phone: params.phone,
        email: params.email,
        company: params.company,
        title: params.title,
        url: params.url,
        address: params.address,
      });
    case 'email':
      return `mailto:${params.email || ''}`;
    case 'sms':
      return `SMSTO:${params.phone || ''}:${params.message || ''}`;
    case 'phone':
      return `tel:${params.phone || ''}`;
    default:
      return params.text || '';
  }
}

/* ============================================================
 *  二维码生成核心
 * ============================================================ */

/**
 * 获取二维码模块数据（二维布尔数组）
 */
export async function getQrModules(
  content: string,
  errorLevel: QrErrorLevel = 'M',
): Promise<{ modules: boolean[][]; moduleCount: number }> {
  const canvas = document.createElement('canvas');
  await QRCode.toCanvas(canvas, content, {
    errorCorrectionLevel: errorLevel,
    margin: 0,
    width: 100,
  });

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  // 计算模块数量
  const size = canvas.width;
  // 找到第一个黑色像素的行来确定模块大小
  let moduleSize = 1;
  let firstBlackX = -1;
  for (let x = 0; x < size; x++) {
    const idx = (0 * size + x) * 4;
    if (data[idx] < 128) {
      firstBlackX = x;
      break;
    }
  }
  if (firstBlackX >= 0) {
    // 计算连续黑色像素宽度 = 模块大小
    let count = 0;
    for (let x = firstBlackX; x < size; x++) {
      const idx = (0 * size + x) * 4;
      if (data[idx] < 128) count++;
      else break;
    }
    if (count > 0) moduleSize = count;
  }

  const moduleCount = Math.round(size / moduleSize);
  const modules: boolean[][] = [];

  for (let row = 0; row < moduleCount; row++) {
    const rowArr: boolean[] = [];
    for (let col = 0; col < moduleCount; col++) {
      const x = Math.floor(col * moduleSize + moduleSize / 2);
      const y = Math.floor(row * moduleSize + moduleSize / 2);
      const idx = (y * size + x) * 4;
      // 黑色像素 = true（模块存在）
      rowArr.push(data[idx] < 128);
    }
    modules.push(rowArr);
  }

  return { modules, moduleCount };
}

/**
 * 判断是否为定位点区域
 */
export function isFinderPattern(row: number, col: number, moduleCount: number): boolean {
  // 左上角定位点 (0-6, 0-6)
  if (row < 7 && col < 7) return true;
  // 右上角定位点 (0-6, moduleCount-7 ~ moduleCount-1)
  if (row < 7 && col >= moduleCount - 7) return true;
  // 左下角定位点 (moduleCount-7 ~ moduleCount-1, 0-6)
  if (row >= moduleCount - 7 && col < 7) return true;
  return false;
}

/**
 * 创建渐变填充
 */
export function createGradient(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  startColor: string,
  endColor: string,
  angleDeg: number,
): CanvasGradient {
  const angle = (angleDeg * Math.PI) / 180;
  const centerX = width / 2;
  const centerY = height / 2;
  const diag = Math.sqrt(width * width + height * height) / 2;

  const x1 = centerX - Math.cos(angle) * diag;
  const y1 = centerY - Math.sin(angle) * diag;
  const x2 = centerX + Math.cos(angle) * diag;
  const y2 = centerY + Math.sin(angle) * diag;

  const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
  gradient.addColorStop(0, startColor);
  gradient.addColorStop(1, endColor);
  return gradient;
}

/**
 * 绘制圆角矩形
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 绘制定位点
 */
export function drawFinderPattern(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  moduleSize: number,
  style: FinderPatternStyle,
  color: string,
): void {
  const size = moduleSize * 7;
  const innerSize = moduleSize * 3;
  const innerOffset = moduleSize * 2;

  ctx.fillStyle = color;

  if (style === 'square') {
    // 外框
    ctx.fillRect(x, y, size, moduleSize);
    ctx.fillRect(x, y, moduleSize, size);
    ctx.fillRect(x, y + size - moduleSize, size, moduleSize);
    ctx.fillRect(x + size - moduleSize, y, moduleSize, size);
    // 中心方块
    ctx.fillRect(x + innerOffset, y + innerOffset, innerSize, innerSize);
  } else if (style === 'rounded') {
    const r = moduleSize * 0.5;
    // 外框 - 用圆角矩形描边
    ctx.lineWidth = moduleSize;
    ctx.strokeStyle = color;
    drawRoundedRect(ctx, x + moduleSize / 2, y + moduleSize / 2, size - moduleSize, size - moduleSize, r);
    ctx.stroke();
    // 中心方块
    drawRoundedRect(ctx, x + innerOffset, y + innerOffset, innerSize, innerSize, r * 0.6);
    ctx.fill();
  } else if (style === 'circle') {
    const cx = x + size / 2;
    const cy = y + size / 2;
    // 外圆环
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2 - moduleSize / 2, 0, Math.PI * 2);
    ctx.lineWidth = moduleSize;
    ctx.strokeStyle = color;
    ctx.stroke();
    // 中心圆
    ctx.beginPath();
    ctx.arc(cx, cy, innerSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
}

/**
 * 生成美化后的二维码
 */
export async function generateQrCode(config: QrGenerateConfig): Promise<QrGenerateResult> {
  const {
    content,
    size = 300,
    errorLevel = 'M',
    foreground = '#000000',
    background = '#ffffff',
    margin = 2,
    style = 'classic',
    useGradient = false,
    gradientStart = '#6366f1',
    gradientEnd = '#8b5cf6',
    gradientAngle = 135,
    finderPattern = 'square',
    finderColor = '',
    logoImage = null,
    logoRatio = 0.2,
    logoRadius = 8,
    logoBgColor = '#ffffff',
    addWatermark = false,
    watermarkText = '试用版',
  } = config;

  if (!content || content.trim().length === 0) {
    throw new Error('二维码内容不能为空');
  }

  // 获取模块数据
  const { modules, moduleCount } = await getQrModules(content, errorLevel);

  // 计算实际画布尺寸（含边距）
  const totalModules = moduleCount + margin * 2;
  const moduleSize = Math.floor(size / totalModules);
  const actualSize = moduleSize * totalModules;

  const canvas = document.createElement('canvas');
  canvas.width = actualSize;
  canvas.height = actualSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('无法创建 Canvas 上下文');

  // 绘制背景
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, actualSize, actualSize);

  // 设置前景色（纯色或渐变）
  let fillStyle: string | CanvasGradient = foreground;
  if (useGradient) {
    fillStyle = createGradient(ctx, actualSize, actualSize, gradientStart, gradientEnd, gradientAngle);
  }
  ctx.fillStyle = fillStyle;

  const offset = margin * moduleSize;
  const finderColorFinal = finderColor || foreground;

  // 绘制数据模块（非定位点区域）
  for (let row = 0; row < moduleCount; row++) {
    for (let col = 0; col < moduleCount; col++) {
      if (!modules[row][col]) continue;
      if (isFinderPattern(row, col, moduleCount)) continue;

      const x = offset + col * moduleSize;
      const y = offset + row * moduleSize;

      if (style === 'classic') {
        ctx.fillRect(x, y, moduleSize, moduleSize);
      } else if (style === 'dots') {
        const cx = x + moduleSize / 2;
        const cy = y + moduleSize / 2;
        const r = moduleSize * 0.4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
      } else if (style === 'squares') {
        const pad = moduleSize * 0.15;
        const r = moduleSize * 0.2;
        drawRoundedRect(ctx, x + pad, y + pad, moduleSize - pad * 2, moduleSize - pad * 2, r);
        ctx.fill();
      } else if (style === 'liquid') {
        // 液态风格：圆角更大，且根据相邻模块连接
        const pad = moduleSize * 0.1;
        const r = moduleSize * 0.45;
        drawRoundedRect(ctx, x + pad, y + pad, moduleSize - pad * 2, moduleSize - pad * 2, r);
        ctx.fill();

        // 检查右侧和下侧模块，如果也为黑色，绘制连接圆角
        const hasRight = col + 1 < moduleCount && modules[row][col + 1] && !isFinderPattern(row, col + 1, moduleCount);
        const hasBottom = row + 1 < moduleCount && modules[row + 1][col] && !isFinderPattern(row + 1, col, moduleCount);

        if (hasRight) {
          ctx.fillRect(x + moduleSize - pad, y + pad + moduleSize * 0.1, pad * 2, moduleSize - pad * 2 - moduleSize * 0.2);
        }
        if (hasBottom) {
          ctx.fillRect(x + pad + moduleSize * 0.1, y + moduleSize - pad, moduleSize - pad * 2 - moduleSize * 0.2, pad * 2);
        }
      }
    }
  }

  // 绘制定位点
  ctx.fillStyle = finderColorFinal;
  const finderSize = 7 * moduleSize;
  // 左上
  drawFinderPattern(ctx, offset, offset, moduleSize, finderPattern, finderColorFinal);
  // 右上
  drawFinderPattern(ctx, offset + (moduleCount - 7) * moduleSize, offset, moduleSize, finderPattern, finderColorFinal);
  // 左下
  drawFinderPattern(ctx, offset, offset + (moduleCount - 7) * moduleSize, moduleSize, finderPattern, finderColorFinal);

  // 绘制 Logo
  if (logoImage && logoImage.complete && logoImage.naturalWidth > 0) {
    const logoSize = actualSize * logoRatio;
    const logoX = (actualSize - logoSize) / 2;
    const logoY = (actualSize - logoSize) / 2;

    // Logo 背景（白色圆角底，避免二维码图案干扰）
    const bgPadding = logoSize * 0.1;
    drawRoundedRect(
      ctx,
      logoX - bgPadding,
      logoY - bgPadding,
      logoSize + bgPadding * 2,
      logoSize + bgPadding * 2,
      logoRadius,
    );
    ctx.fillStyle = logoBgColor;
    ctx.fill();

    // 绘制 Logo 图片
    ctx.save();
    drawRoundedRect(ctx, logoX, logoY, logoSize, logoSize, logoRadius * 0.7);
    ctx.clip();
    ctx.drawImage(logoImage, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  // 添加试用水印
  if (addWatermark && watermarkText) {
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.font = `${Math.max(10, actualSize * 0.03)}px Arial, sans-serif`;
    ctx.fillStyle = foreground;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 右下角小水印
    ctx.fillText(watermarkText, actualSize - actualSize * 0.08, actualSize - actualSize * 0.04);
    ctx.restore();
  }

  const dataUrl = canvas.toDataURL('image/png');

  return {
    canvas,
    dataUrl,
    modules,
    moduleCount,
  };
}

/* ============================================================
 *  二维码识别
 * ============================================================ */

/**
 * 从图片文件识别二维码
 */
export async function decodeQrFromFile(file: File): Promise<QrDecodeResult> {
  try {
    const img = await loadImage(file);
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return { success: false, text: '', error: '无法创建 Canvas 上下文', fileName: file.name };
    }
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: 'attemptBoth',
    });

    if (code && code.data) {
      return { success: true, text: code.data, fileName: file.name };
    }

    return { success: false, text: '', error: '未识别到二维码', fileName: file.name };
  } catch (error) {
    logger.error('QR decode failed:', String(error));
    return { success: false, text: '', error: '识别失败：图片格式不支持或已损坏', fileName: file.name };
  }
}

/**
 * 批量识别二维码
 */
export async function batchDecodeQr(files: File[]): Promise<QrDecodeResult[]> {
  const results: QrDecodeResult[] = [];
  for (const file of files) {
    const result = await decodeQrFromFile(file);
    results.push(result);
  }
  return results;
}

/* ============================================================
 *  批量生成
 * ============================================================ */

/**
 * 批量生成二维码
 */
export async function batchGenerateQr(
  items: QrBatchItem[],
  config: Omit<QrGenerateConfig, 'content'>,
  onProgress?: (current: number, total: number) => void,
): Promise<QrBatchItem[]> {
  const results: QrBatchItem[] = [];
  const total = items.length;

  for (let i = 0; i < total; i++) {
    const item = items[i];
    try {
      const result = await generateQrCode({
        ...config,
        content: item.content,
      });
      results.push({ ...item, result });
    } catch (error) {
      logger.error(`Batch generate failed for ${item.content}:`, String(error));
      results.push({ ...item, error: String(error) });
    }
    onProgress?.(i + 1, total);
  }

  return results;
}

/* ============================================================
 *  导出工具
 * ============================================================ */

/**
 * 导出为 PNG
 */
export function exportAsPng(canvas: HTMLCanvasElement, fileName: string = 'qrcode.png'): void {
  const url = canvas.toDataURL('image/png');
  triggerDownload(url, fileName);
}

/**
 * 导出为 SVG
 */
export async function exportAsSvg(
  content: string,
  size: number,
  foreground: string,
  background: string,
  errorLevel: QrErrorLevel = 'M',
  margin: number = 2,
  fileName: string = 'qrcode.svg',
): Promise<void> {
  const svgString = await QRCode.toString(content, {
    type: 'svg',
    errorCorrectionLevel: errorLevel,
    margin,
    width: size,
    color: {
      dark: foreground,
      light: background,
    },
  });
  const blob = new Blob([svgString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 触发浏览器下载
 */
export function triggerDownload(url: string, fileName: string): void {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * 批量导出 PNG（逐个下载简化方案）
 */
export function batchDownloadPng(items: QrBatchItem[], delayMs: number = 200): void {
  items.forEach((item, index) => {
    if (item.result) {
      setTimeout(() => {
        exportAsPng(item.result!.canvas, `${item.fileName || `qrcode_${index + 1}`}.png`);
      }, index * delayMs);
    }
  });
}

/* ============================================================
 *  辅助工具
 * ============================================================ */

/**
 * 加载图片文件为 HTMLImageElement
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };
    img.src = url;
  });
}

/**
 * 从 URL 加载图片
 */
export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = url;
  });
}

/**
 * 复制文本到剪贴板
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textarea);
      return true;
    } catch {
      document.body.removeChild(textarea);
      return false;
    }
  }
}

/**
 * 导出识别结果为文本文件
 */
export function exportDecodeResults(results: QrDecodeResult[], fileName: string = 'qr_results.txt'): void {
  const lines = results.map((r, i) => {
    if (r.success) {
      return `[${i + 1}] ${r.fileName || '文件' + (i + 1)}:\n${r.text}\n`;
    }
    return `[${i + 1}] ${r.fileName || '文件' + (i + 1)}: 识别失败 - ${r.error}\n`;
  });
  const content = lines.join('\n');
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  triggerDownload(url, fileName);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 校验是否为图片文件
 */
export function isImageFile(file: File): boolean {
  if (file.type && file.type.startsWith('image/')) return true;
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg'].includes(ext || '');
}
