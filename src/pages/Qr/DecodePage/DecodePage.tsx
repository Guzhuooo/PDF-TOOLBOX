import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import jsQR from 'jsqr';
import {
  ScanLine,
  Upload,
  Copy,
  Check,
  FileText,
  Download,
  Trash2,
  Image as ImageIcon,
  AlertTriangle,
  RefreshCw,
  X,
  ExternalLink,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';

/* ============================================================
 *  类型定义
 * ============================================================ */

interface DecodeItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  status: 'pending' | 'processing' | 'success' | 'failed';
  result: string;
  error?: string;
}

/* ============================================================
 *  工具函数
 * ============================================================ */

function genId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * 从图片中识别二维码
 */
async function decodeQrFromImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(url);
          reject(new Error('无法创建 Canvas 上下文'));
          return;
        }

        // 限制最大尺寸，避免大图片性能问题
        const maxSize = 1600;
        let { naturalWidth: w, naturalHeight: h } = img;
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }

        canvas.width = w;
        canvas.height = h;
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, w, h);

        const imageData = ctx.getImageData(0, 0, w, h);
        const code = jsQR(imageData.data, w, h, {
          inversionAttempts: 'attemptBoth',
        });

        URL.revokeObjectURL(url);

        if (code && code.data) {
          resolve(code.data);
        } else {
          reject(new Error('未识别到二维码'));
        }
      } catch (err) {
        URL.revokeObjectURL(url);
        reject(err instanceof Error ? err : new Error('识别失败'));
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片加载失败'));
    };

    img.src = url;
  });
}

/* ============================================================
 *  页面组件
 * ============================================================ */

export default function QrDecodePage() {
  const { isTrial, trialLimits } = useLicense();
  const [items, setItems] = useState<DecodeItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 成功识别的结果数 */
  const successCount = useMemo(
    () => items.filter((i) => i.status === 'success').length,
    [items],
  );

  /** 所有成功结果的文本 */
  const allResultsText = useMemo(() => {
    return items
      .filter((i) => i.status === 'success')
      .map((i, idx) => `【${idx + 1}】${i.name}\n${i.result}`)
      .join('\n\n---\n\n');
  }, [items]);

  /**
   * 处理文件上传
   */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files);
      const imageFiles = fileArr.filter((f) => f.type.startsWith('image/'));

      if (imageFiles.length === 0) {
        toast.error('请选择图片文件');
        return;
      }

      // 试用版限制
      if (isTrial) {
        const maxFiles = trialLimits.qrMaxBatch;
        const remaining = maxFiles - items.length;
        if (remaining <= 0) {
          toast.warning(`试用版最多识别 ${maxFiles} 张图片，激活后解锁无限制`);
          return;
        }
        if (imageFiles.length > remaining) {
          toast.warning(`试用版最多识别 ${maxFiles} 张，已截取前 ${remaining} 张`);
          imageFiles.length = remaining;
        }
      }

      const newItems: DecodeItem[] = imageFiles.map((file) => ({
        id: genId(),
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
        result: '',
      }));

      setItems((prev) => [...prev, ...newItems]);
    },
    [isTrial, trialLimits.qrMaxBatch, items.length],
  );

  /**
   * 拖拽事件处理
   */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  /**
   * 开始识别
   */
  const handleDecode = useCallback(async () => {
    const pendingItems = items.filter((i) => i.status === 'pending');
    if (pendingItems.length === 0) {
      toast.info('没有待识别的图片');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const total = pendingItems.length;
    let done = 0;

    for (const item of pendingItems) {
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'processing' } : i)),
      );

      try {
        const result = await decodeQrFromImage(item.file);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, status: 'success', result } : i,
          ),
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? {
                  ...i,
                  status: 'failed',
                  error: err instanceof Error ? err.message : '识别失败',
                }
              : i,
          ),
        );
      }

      done++;
      setProgress(Math.round((done / total) * 100));
    }

    setIsProcessing(false);
    const success = items.filter(
      (i) => i.status === 'success' || pendingItems.find((p) => p.id === i.id),
    ).length;
    toast.success(`识别完成，成功 ${successCount + (items.filter(i => i.status === 'success').length - successCount)} 张`);
  }, [items, successCount]);

  /**
   * 复制单个结果
   */
  const handleCopy = useCallback(
    async (text: string, id: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopiedId(id);
        toast.success('已复制到剪贴板');
        setTimeout(() => setCopiedId(null), 1500);
      } catch {
        toast.error('复制失败');
      }
    },
    [],
  );

  /**
   * 复制全部结果
   */
  const handleCopyAll = useCallback(async () => {
    if (!allResultsText) return;
    try {
      await navigator.clipboard.writeText(allResultsText);
      toast.success('已复制全部结果');
    } catch {
      toast.error('复制失败');
    }
  }, [allResultsText]);

  /**
   * 导出结果为 TXT
   */
  const handleExport = useCallback(() => {
    if (!allResultsText) return;
    const blob = new Blob([allResultsText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `二维码识别结果_${items.length}张.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('已导出识别结果');
  }, [allResultsText, items.length]);

  /**
   * 删除单个
   */
  const handleRemove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  /**
   * 清空全部
   */
  const handleClear = useCallback(() => {
    items.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
    });
    setItems([]);
    setProgress(0);
  }, [items]);

  /**
   * 打开链接（如果结果是 URL）
   */
  const handleOpenLink = useCallback((url: string) => {
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
    } else {
      toast.info('识别结果不是网址，无法打开');
    }
  }, []);

  const hasPending = items.some((i) => i.status === 'pending');

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl" />
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg">
              <ScanLine className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">二维码识别</h1>
            <p className="text-sm text-muted-foreground">
              上传图片自动识别二维码内容，支持批量识别
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 最多 {trialLimits.qrMaxBatch} 张
            </Badge>
          )}
        </div>
      </motion.div>

      {/* 上传区 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-6">
            <div
              className={cn(
                'relative rounded-xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden',
                'flex flex-col items-center justify-center py-12 px-6 text-center',
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-border/60 bg-muted/20 hover:border-primary/50 hover:bg-muted/40',
              )}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />

              <motion.div
                animate={isDragging ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.6, repeat: isDragging ? Infinity : 0 }}
                className="relative mb-4"
              >
                <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
                <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
              </motion.div>

              <p className="text-base font-medium text-foreground mb-1">
                拖拽图片到此处，或点击选择文件
              </p>
              <p className="text-sm text-muted-foreground">
                支持 JPG、PNG、WebP、BMP、GIF 等常见图片格式，可批量上传
              </p>

              {isTrial && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-3">
                  试用版最多识别 {trialLimits.qrMaxBatch} 张图片
                </p>
              )}
            </div>

            {/* 进度条 */}
            <AnimatePresence>
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 space-y-2"
                >
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">识别中...</span>
                    <span className="font-medium text-primary">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-2" />
                </motion.div>
              )}
            </AnimatePresence>

            {/* 操作按钮 */}
            {items.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-wrap items-center justify-between gap-3 mt-4 pt-4 border-t border-border/30"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    共 {items.length} 张
                  </Badge>
                  {successCount > 0 && (
                    <Badge variant="outline" className="text-xs text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
                      成功 {successCount}
                    </Badge>
                  )}
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {hasPending && (
                    <Button
                      onClick={handleDecode}
                      disabled={isProcessing}
                      className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
                    >
                      {isProcessing ? (
                        <>
                          <RefreshCw className="h-4 w-4 animate-spin" />
                          识别中...
                        </>
                      ) : (
                        <>
                          <ScanLine className="h-4 w-4" />
                          开始识别
                        </>
                      )}
                    </Button>
                  )}

                  {successCount > 0 && (
                    <>
                      <Button variant="outline" size="sm" onClick={handleCopyAll} className="gap-2">
                        <Copy className="h-4 w-4" />
                        复制全部
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
                        <Download className="h-4 w-4" />
                        导出TXT
                      </Button>
                    </>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClear}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    清空
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 识别结果列表 */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                识别结果
              </CardTitle>
              <CardDescription className="text-xs">
                点击结果可复制，链接可直接打开
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <AnimatePresence>
                {items.map((item, index) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3, delay: index * 0.03 }}
                    className={cn(
                      'relative rounded-xl border transition-all duration-300 overflow-hidden',
                      item.status === 'success'
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : item.status === 'failed'
                          ? 'border-destructive/30 bg-destructive/5'
                          : item.status === 'processing'
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border/50 bg-card/50',
                    )}
                  >
                    <div className="flex gap-4 p-4">
                      {/* 缩略图 */}
                      <div className="shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted/50 border border-border/30">
                        <Image
                          src={item.previewUrl}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-sm font-medium text-foreground truncate">
                            {item.name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            {item.status === 'success' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                              >
                                识别成功
                              </Badge>
                            )}
                            {item.status === 'failed' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-destructive border-destructive/30 bg-destructive/10"
                              >
                                识别失败
                              </Badge>
                            )}
                            {item.status === 'processing' && (
                              <Badge
                                variant="outline"
                                className="text-[10px] text-primary border-primary/30 bg-primary/10"
                              >
                                识别中
                              </Badge>
                            )}
                            {item.status === 'pending' && (
                              <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                待识别
                              </Badge>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 rounded-full"
                              onClick={() => handleRemove(item.id)}
                              aria-label="删除"
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground mb-2">
                          {formatFileSize(item.size)}
                        </div>

                        {/* 结果文本 */}
                        {item.status === 'success' && item.result && (
                          <div className="relative">
                            <div className="text-sm text-foreground bg-white/60 dark:bg-slate-800/60 rounded-lg p-2.5 border border-border/30 max-h-20 overflow-y-auto break-all">
                              {item.result}
                            </div>
                            <div className="flex items-center gap-1 mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs gap-1"
                                onClick={() => handleCopy(item.result, item.id)}
                              >
                                {copiedId === item.id ? (
                                  <>
                                    <Check className="h-3 w-3 text-emerald-500" />
                                    已复制
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    复制
                                  </>
                                )}
                              </Button>
                              {/^https?:\/\//i.test(item.result) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs gap-1"
                                  onClick={() => handleOpenLink(item.result)}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  打开链接
                                </Button>
                              )}
                            </div>
                          </div>
                        )}

                        {/* 失败原因 */}
                        {item.status === 'failed' && item.error && (
                          <div className="flex items-center gap-1.5 text-xs text-destructive">
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                            <span>{item.error}</span>
                          </div>
                        )}

                        {/* 待识别提示 */}
                        {item.status === 'pending' && (
                          <div className="text-xs text-muted-foreground italic">
                            点击"开始识别"按钮进行识别
                          </div>
                        )}

                        {/* 识别中 */}
                        {item.status === 'processing' && (
                          <div className="flex items-center gap-2 text-xs text-primary">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            <span>正在识别...</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 空状态提示 */}
      {items.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardContent className="p-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="relative">
                  <div className="absolute inset-0 rounded-full bg-primary/10 blur-xl" />
                  <div className="relative flex items-center justify-center w-20 h-20 rounded-full bg-gradient-to-br from-primary/10 to-purple-500/10">
                    <ImageIcon className="h-10 w-10 text-primary/60" />
                  </div>
                </div>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                上传图片开始识别
              </h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                支持上传包含二维码的图片，自动识别二维码内容。
                可批量上传多张图片，一键识别全部。
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 试用版提示 */}
      {isTrial && items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版</div>
            <div className="text-xs text-muted-foreground">
              试用版最多识别 {trialLimits.qrMaxBatch} 张图片。激活后解锁无限制批量识别。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
