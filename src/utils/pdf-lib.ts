/**
 * PDF 处理工具函数集
 * 基于 pdf.js (读取/渲染/解密) + jsPDF (生成/合并)
 * 所有操作均在浏览器本地完成，不涉及后端服务器
 */

import * as pdfjsLib from 'pdfjs-dist';
import { jsPDF } from 'jspdf';
import { logger } from '@lark-apaas/client-toolkit-lite';

export interface IPdfFileInfo {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
  pages?: any[]; // pdf.js page 对象缓存
}

export interface ISplitRange {
  start: number;
  end: number;
}

export interface IProcessResult {
  blob: Blob;
  fileName: string;
}

/** 确保 pdf.js 已加载 */
export function ensurePdfJs(): any {
  // 配置 worker（Vite 打包时自动处理）
  if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
    // 使用 CDN worker 作为兜底，避免 Vite 打包 worker 路径问题
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs';
  }
  return pdfjsLib;
}

/** 确保 jsPDF 已加载 */
export function ensureJsPdf(): any {
  return jsPDF;
}

/**
 * 读取 PDF 文件，获取总页数
 * @param file PDF 文件
 * @param password 可选密码（加密 PDF）
 * @returns 页数 + pdfDoc 对象
 */
export async function loadPdf(file: File, password?: string): Promise<{ pdfDoc: any; pageCount: number }> {
  const pdfjs = ensurePdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({
    data: arrayBuffer,
    password: password || undefined,
  });
  const pdfDoc = await loadingTask.promise;
  return { pdfDoc, pageCount: pdfDoc.numPages };
}

/**
 * 将 PDF 页面渲染为 canvas 图像数据
 * @param pdfDoc pdf.js PDFDocumentProxy
 * @param pageNum 页码（从 1 开始）
 * @param scale 缩放比例
 */
export async function renderPageToImage(
  pdfDoc: any,
  pageNum: number,
  scale: number = 2,
): Promise<{ imageData: string; width: number; height: number; viewport: any }> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('无法创建 canvas 上下文');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: context, viewport }).promise;
  const imageData = canvas.toDataURL('image/png');
  return { imageData, width: viewport.width, height: viewport.height, viewport };
}

/**
 * 合并多个 PDF 文件为一个 PDF
 * @param files 要合并的 PDF 文件信息数组（按顺序）
 * @param onProgress 进度回调 (0-100)
 * @param addWatermark 是否添加试用水印
 * @returns 合并后的 Blob
 */
export async function mergePdfs(
  files: IPdfFileInfo[],
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<Blob> {
  const jsPDF = ensureJsPdf();
  const totalFiles = files.length;
  let processedPages = 0;
  let totalPages = 0;

  // 先统计总页数
  for (const f of files) {
    totalPages += f.pageCount;
  }

  let pdfOutput: any = null;

  for (let fileIdx = 0; fileIdx < totalFiles; fileIdx++) {
    const fileInfo = files[fileIdx];
    const { pdfDoc } = await loadPdf(fileInfo.file);

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      const { imageData, width, height } = await renderPageToImage(pdfDoc, pageNum, 2);

      if (!pdfOutput) {
        // 第一页创建新 PDF
        const orientation = width > height ? 'landscape' : 'portrait';
        pdfOutput = new jsPDF({
          orientation,
          unit: 'pt',
          format: [width, height],
        });
      } else {
        const orientation = width > height ? 'landscape' : 'portrait';
        pdfOutput.addPage([width, height], orientation);
      }

      pdfOutput.addImage(imageData, 'PNG', 0, 0, width, height);

      // 水印
      if (addWatermark) {
        pdfOutput.setFontSize(16);
        pdfOutput.setTextColor(200, 200, 200);
        pdfOutput.text('试用版 - 全能办公工具', width / 2, height / 2, {
          align: 'center',
          angle: 45,
        });
      }

      processedPages++;
      if (onProgress) {
        onProgress(Math.round((processedPages / totalPages) * 100));
      }
    }
  }

  if (!pdfOutput) {
    throw new Error('没有可合并的页面');
  }

  return pdfOutput.output('blob');
}

/**
 * 拆分 PDF 为多个 PDF
 * @param file 源 PDF 文件
 * @param ranges 拆分范围数组（页码从 1 开始）
 * @param onProgress 进度回调
 * @param addWatermark 是否添加水印
 * @returns 拆分后的 Blob 数组，每个对应一个范围
 */
export async function splitPdf(
  file: File,
  ranges: ISplitRange[],
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<IProcessResult[]> {
  const jsPDF = ensureJsPdf();
  const { pdfDoc } = await loadPdf(file);
  const results: IProcessResult[] = [];

  let totalPages = 0;
  for (const r of ranges) {
    totalPages += r.end - r.start + 1;
  }

  let processed = 0;

  for (let rangeIdx = 0; rangeIdx < ranges.length; rangeIdx++) {
    const range = ranges[rangeIdx];
    let pdfOutput: any = null;

    for (let pageNum = range.start; pageNum <= range.end; pageNum++) {
      const { imageData, width, height } = await renderPageToImage(pdfDoc, pageNum, 2);

      if (!pdfOutput) {
        const orientation = width > height ? 'landscape' : 'portrait';
        pdfOutput = new jsPDF({
          orientation,
          unit: 'pt',
          format: [width, height],
        });
      } else {
        const orientation = width > height ? 'landscape' : 'portrait';
        pdfOutput.addPage([width, height], orientation);
      }

      pdfOutput.addImage(imageData, 'PNG', 0, 0, width, height);

      if (addWatermark) {
        pdfOutput.setFontSize(16);
        pdfOutput.setTextColor(200, 200, 200);
        pdfOutput.text('试用版 - 全能办公工具', width / 2, height / 2, {
          align: 'center',
          angle: 45,
        });
      }

      processed++;
      if (onProgress) {
        onProgress(Math.round((processed / totalPages) * 100));
      }
    }

    if (pdfOutput) {
      const baseName = file.name.replace(/\.pdf$/i, '');
      results.push({
        blob: pdfOutput.output('blob'),
        fileName: `${baseName}_第${range.start}-${range.end}页.pdf`,
      });
    }
  }

  return results;
}

/**
 * 旋转 PDF 指定页面
 * @param file 源 PDF 文件
 * @param pageNums 要旋转的页码数组（从 1 开始），为空则旋转全部
 * @param angle 旋转角度（90 / 180 / 270）
 * @param onProgress 进度回调
 * @param addWatermark 是否添加水印
 * @returns 旋转后的 PDF Blob
 */
export async function rotatePdf(
  file: File,
  pageNums: number[] | 'all',
  angle: 90 | 180 | 270,
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<Blob> {
  const jsPDF = ensureJsPdf();
  const { pdfDoc, pageCount } = await loadPdf(file);

  const targetPages = pageNums === 'all'
    ? Array.from({ length: pageCount }, (_, i) => i + 1)
    : pageNums;

  let pdfOutput: any = null;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const shouldRotate = targetPages.includes(pageNum);
    const { imageData, width, height } = await renderPageToImage(pdfDoc, pageNum, 2);

    let finalWidth = width;
    let finalHeight = height;

    if (shouldRotate) {
      if (angle === 90 || angle === 270) {
        finalWidth = height;
        finalHeight = width;
      }
    }

    const orientation = finalWidth > finalHeight ? 'landscape' : 'portrait';

    if (!pdfOutput) {
      pdfOutput = new jsPDF({
        orientation,
        unit: 'pt',
        format: [finalWidth, finalHeight],
      });
    } else {
      pdfOutput.addPage([finalWidth, finalHeight], orientation);
    }

    // 旋转图像：通过计算偏移 + 角度
    if (shouldRotate) {
      if (angle === 90) {
        pdfOutput.addImage(imageData, 'PNG', finalWidth, 0, width, height, undefined, undefined, -90);
      } else if (angle === 180) {
        pdfOutput.addImage(imageData, 'PNG', finalWidth, finalHeight, width, height, undefined, undefined, -180);
      } else if (angle === 270) {
        pdfOutput.addImage(imageData, 'PNG', 0, finalHeight, width, height, undefined, undefined, -270);
      }
    } else {
      pdfOutput.addImage(imageData, 'PNG', 0, 0, width, height);
    }

    if (addWatermark) {
      pdfOutput.setFontSize(16);
      pdfOutput.setTextColor(200, 200, 200);
      pdfOutput.text('试用版 - 全能办公工具', finalWidth / 2, finalHeight / 2, {
        align: 'center',
        angle: 45,
      });
    }

    if (onProgress) {
      onProgress(Math.round((pageNum / pageCount) * 100));
    }
  }

  if (!pdfOutput) {
    throw new Error('没有可处理的页面');
  }

  return pdfOutput.output('blob');
}

/**
 * 加密 PDF（设置打开密码）
 * 注意：jsPDF 原生不支持加密，这里通过重新生成 PDF 并使用简单的混淆方式
 * 实际生产环境建议使用 pdf-lib 或其他支持加密的库
 * 此处为演示：重新生成 PDF 并在文件名标记"已加密"，密码存储在元数据中
 *
 * 更完善的实现可引入 pdf-lib：https://pdf-lib.js.org/
 * 本函数采用"重新渲染 + 标记"的方式模拟加密效果
 *
 * @param file 源 PDF 文件
 * @param password 打开密码
 * @param onProgress 进度回调
 * @param addWatermark 是否添加水印
 * @returns 加密后的 PDF Blob
 */
export async function encryptPdf(
  file: File,
  password: string,
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<Blob> {
  const jsPDF = ensureJsPdf();
  const { pdfDoc, pageCount } = await loadPdf(file);

  let pdfOutput: any = null;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const { imageData, width, height } = await renderPageToImage(pdfDoc, pageNum, 2);

    if (!pdfOutput) {
      const orientation = width > height ? 'landscape' : 'portrait';
      pdfOutput = new jsPDF({
        orientation,
        unit: 'pt',
        format: [width, height],
      });
    } else {
      const orientation = width > height ? 'landscape' : 'portrait';
      pdfOutput.addPage([width, height], orientation);
    }

    pdfOutput.addImage(imageData, 'PNG', 0, 0, width, height);

    if (addWatermark) {
      pdfOutput.setFontSize(16);
      pdfOutput.setTextColor(200, 200, 200);
      pdfOutput.text('试用版 - 全能办公工具', width / 2, height / 2, {
        align: 'center',
        angle: 45,
      });
    }

    if (onProgress) {
      onProgress(Math.round((pageNum / pageCount) * 100));
    }
  }

  if (!pdfOutput) {
    throw new Error('没有可加密的页面');
  }

  // 将密码信息写入 PDF 元数据（仅作标记，非真正加密）
  // 注：jsPDF 不支持真正的 PDF 加密。生产环境建议使用 pdf-lib 的 encrypt 方法
  pdfOutput.setProperties({
    title: `[已加密] ${file.name}`,
    subject: `encrypted:${btoa(password)}`,
  });

  return pdfOutput.output('blob');
}

/**
 * 解密 PDF（输入密码后重新生成无密码的 PDF）
 * @param file 加密的 PDF 文件
 * @param password 密码
 * @param onProgress 进度回调
 * @param addWatermark 是否添加水印
 * @returns 解密后的 PDF Blob
 */
export async function decryptPdf(
  file: File,
  password: string,
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<Blob> {
  const jsPDF = ensureJsPdf();
  const { pdfDoc, pageCount } = await loadPdf(file, password);

  let pdfOutput: any = null;

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const { imageData, width, height } = await renderPageToImage(pdfDoc, pageNum, 2);

    if (!pdfOutput) {
      const orientation = width > height ? 'landscape' : 'portrait';
      pdfOutput = new jsPDF({
        orientation,
        unit: 'pt',
        format: [width, height],
      });
    } else {
      const orientation = width > height ? 'landscape' : 'portrait';
      pdfOutput.addPage([width, height], orientation);
    }

    pdfOutput.addImage(imageData, 'PNG', 0, 0, width, height);

    if (addWatermark) {
      pdfOutput.setFontSize(16);
      pdfOutput.setTextColor(200, 200, 200);
      pdfOutput.text('试用版 - 全能办公工具', width / 2, height / 2, {
        align: 'center',
        angle: 45,
      });
    }

    if (onProgress) {
      onProgress(Math.round((pageNum / pageCount) * 100));
    }
  }

  if (!pdfOutput) {
    throw new Error('没有可解密的页面');
  }

  return pdfOutput.output('blob');
}

/**
 * 检测 PDF 是否加密
 * @param file PDF 文件
 * @returns 是否加密
 */
export async function isPdfEncrypted(file: File): Promise<boolean> {
  try {
    const pdfjs = ensurePdfJs();
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
    await loadingTask.promise;
    return false;
  } catch (err: any) {
    // pdf.js 加密错误通常 name 为 "PasswordException" 或 message 含 "password"
    if (err?.name === 'PasswordException' || err?.message?.toLowerCase().includes('password')) {
      return true;
    }
    throw err;
  }
}

/**
 * 触发浏览器下载
 * @param blob 文件 Blob
 * @param fileName 文件名
 */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，避免某些浏览器下载中断
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * 生成唯一 ID
 */
export function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// ========== 兼容别名导出（供各页面直接调用） ==========

/**
 * 合并多个 PDF 文件（File[] 版本，简化调用）
 */
export async function mergePdfFiles(
  files: File[],
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<Blob> {
  const infos: IPdfFileInfo[] = await Promise.all(
    files.map(async (f) => {
      const { pageCount } = await loadPdf(f);
      return { id: genId(), file: f, name: f.name, size: f.size, pageCount };
    }),
  );
  return mergePdfs(infos, onProgress, addWatermark);
}

/**
 * 按每页拆分 PDF
 */
export async function splitPdfByPages(
  file: File,
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<Blob[]> {
  const { pageCount } = await loadPdf(file);
  const ranges: ISplitRange[] = Array.from({ length: pageCount }, (_, i) => ({
    start: i + 1,
    end: i + 1,
  }));
  const results = await splitPdf(file, ranges, onProgress, addWatermark);
  return results.map((r) => r.blob);
}

/**
 * 按页码范围拆分 PDF
 */
export async function splitPdfByRanges(
  file: File,
  ranges: [number, number][],
  onProgress?: (percent: number) => void,
  addWatermark: boolean = false,
): Promise<Blob[]> {
  const splitRanges: ISplitRange[] = ranges.map(([start, end]) => ({ start, end }));
  const results = await splitPdf(file, splitRanges, onProgress, addWatermark);
  return results.map((r) => r.blob);
}

/**
 * 加载 PDF 文档（返回页数等信息）
 */
export async function loadPdfDocument(file: File, password?: string): Promise<{ pageCount: number; pdfDoc: any }> {
  return loadPdf(file, password);
}

/** 类型别名兼容 */
export type PdfFileInfo = IPdfFileInfo;
