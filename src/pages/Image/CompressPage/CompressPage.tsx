import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Image as ImageIcon,
  Upload,
  Minimize2,
  Download,
  Trash2,
  Settings,
  RefreshCw,
  Check,
  X,
  FileImage,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';

interface CompressItem {
  id: string;
  file: File;
  name: string;
  originalSize: number;
  originalWidth: number;
  originalHeight: number;
  compressedSize: number | null;
  compressedBlob: Blob | null;
  compressedUrl: string | null;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

export default function ImageCompressPage() {
  const { isTrial, trialLimits } = useLicense();
  const [items, setItems] = useState<CompressItem[]>([]);
  const [quality, setQuality] = useState<number>(80);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 格式化文件大小 */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /** 计算压缩率 */
  const getCompressRatio = (original: number, compressed: number): number => {
    if (original === 0) return 0;
    return Math.round((1 - compressed / original) * 100);
  };

  /** 读取图片获取尺寸 */
  const getImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
        URL.revokeObjectURL(img.src);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  /** 处理文件上传 */
  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter((f) =>
      f.type.startsWith('image/')
    );

    if (fileArray.length === 0) {
      toast.error('请选择图片文件');
      return;
    }

    // 试用版限制
    if (isTrial) {
      const maxFiles = trialLimits.imageMaxFiles;
      if (items.length + fileArray.length > maxFiles) {
        toast.warning(`试用版最多处理 ${maxFiles} 张图片，激活后解锁无限制`);
        return;
      }
    }

    const newItems: CompressItem[] = [];
    for (const file of fileArray) {
      try {
        const dims = await getImageDimensions(file);
        newItems.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          file,
          name: file.name,
          originalSize: file.size,
          originalWidth: dims.width,
          originalHeight: dims.height,
          compressedSize: null,
          compressedBlob: null,
          compressedUrl: null,
          status: 'pending',
        });
      } catch {
        toast.error(`无法读取图片: ${file.name}`);
      }
    }

    setItems((prev) => [...prev, ...newItems]);
  }, [isTrial, trialLimits.imageMaxFiles, items.length]);

  /** 拖拽事件 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  /** 压缩单张图片 */
  const compressImage = (item: CompressItem, qualityVal: number): Promise<CompressItem> => {
    return new Promise((resolve, reject) => {
      const img = new window.Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 canvas 上下文'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          // 转为 JPEG 格式压缩
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('压缩失败'));
                return;
              }
              const url = URL.createObjectURL(blob);
              resolve({
                ...item,
                compressedSize: blob.size,
                compressedBlob: blob,
                compressedUrl: url,
                status: 'done',
              });
            },
            'image/jpeg',
            qualityVal / 100
          );
        } catch (err) {
          reject(err);
        } finally {
          URL.revokeObjectURL(img.src);
        }
      };
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      img.src = URL.createObjectURL(item.file);
    });
  };

  /** 开始批量压缩 */
  const handleCompress = useCallback(async () => {
    if (items.length === 0) {
      toast.error('请先上传图片');
      return;
    }

    const pendingItems = items.filter((i) => i.status === 'pending');
    if (pendingItems.length === 0) {
      toast.info('所有图片已压缩完成');
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    const total = pendingItems.length;
    let completed = 0;

    for (const item of pendingItems) {
      // 更新状态为处理中
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'processing' } : i))
      );

      try {
        const result = await compressImage(item, quality);
        setItems((prev) =>
          prev.map((i) => (i.id === item.id ? result : i))
        );
      } catch (err) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id
              ? { ...i, status: 'error', error: (err as Error).message }
              : i
          )
        );
      }

      completed++;
      setProgress(Math.round((completed / total) * 100));
    }

    setIsProcessing(false);
    toast.success('压缩完成');
  }, [items, quality]);

  /** 删除单张 */
  const handleRemove = useCallback((id: string) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.compressedUrl) {
        URL.revokeObjectURL(item.compressedUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  /** 清空全部 */
  const handleClearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.compressedUrl) {
        URL.revokeObjectURL(item.compressedUrl);
      }
    });
    setItems([]);
    setProgress(0);
  }, [items]);

  /** 下载单张 */
  const handleDownload = useCallback((item: CompressItem) => {
    if (!item.compressedBlob) return;
    const url = URL.createObjectURL(item.compressedBlob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = item.name.replace(/\.[^.]+$/, '');
    a.download = `${baseName}_compressed.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  /** 批量下载 */
  const handleDownloadAll = useCallback(() => {
    const doneItems = items.filter((i) => i.status === 'done' && i.compressedBlob);
    if (doneItems.length === 0) {
      toast.error('没有可下载的文件');
      return;
    }

    doneItems.forEach((item, idx) => {
      setTimeout(() => handleDownload(item), idx * 300);
    });

    toast.success(`开始下载 ${doneItems.length} 个文件`);
  }, [items, handleDownload]);

  /** 质量变化时重新压缩已完成的图片 */
  const handleQualityChange = useCallback(async (value: number[]) => {
    const newQuality = value[0];
    setQuality(newQuality);

    // 重新压缩已完成的图片
    const doneItems = items.filter((i) => i.status === 'done');
    if (doneItems.length > 0 && !isProcessing) {
      setIsProcessing(true);
      setProgress(0);

      const total = doneItems.length;
      let completed = 0;

      for (const item of doneItems) {
        try {
          if (item.compressedUrl) {
            URL.revokeObjectURL(item.compressedUrl);
          }
          const result = await compressImage({ ...item, status: 'pending' }, newQuality);
          setItems((prev) =>
            prev.map((i) => (i.id === item.id ? result : i))
          );
        } catch {
          // ignore
        }
        completed++;
        setProgress(Math.round((completed / total) * 100));
      }

      setIsProcessing(false);
    }
  }, [items, isProcessing]);

  /** 统计数据 */
  const stats = useMemo(() => {
    const doneItems = items.filter((i) => i.status === 'done' && i.compressedSize !== null);
    const totalOriginal = doneItems.reduce((sum, i) => sum + i.originalSize, 0);
    const totalCompressed = doneItems.reduce(
      (sum, i) => sum + (i.compressedSize || 0),
      0
    );
    const saved = totalOriginal - totalCompressed;
    const ratio = totalOriginal > 0 ? Math.round((saved / totalOriginal) * 100) : 0;
    return { totalOriginal, totalCompressed, saved, ratio, doneCount: doneItems.length };
  }, [items]);

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
              <Minimize2 className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">图片压缩</h1>
            <p className="text-sm text-muted-foreground">
              批量压缩图片，支持质量调节，纯前端本地处理
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {items.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll} className="gap-2">
              <Trash2 className="h-4 w-4" />
              清空
            </Button>
          )}
          <Button
            onClick={handleCompress}
            disabled={isProcessing || items.filter((i) => i.status === 'pending').length === 0}
            size="sm"
            className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                压缩中...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                开始压缩
              </>
            )}
          </Button>
          {stats.doneCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              全部下载
            </Button>
          )}
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 限 {trialLimits.imageMaxFiles} 张
            </Badge>
          )}
        </div>
      </motion.div>

      {/* 上传区域 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10 overflow-hidden">
          <CardContent className="p-0">
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                'relative cursor-pointer transition-all duration-300 p-8 md:p-12',
                'border-2 border-dashed rounded-xl m-4 md:m-6',
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.01]'
                  : 'border-border/60 hover:border-primary/50 hover:bg-muted/30'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
              <div className="flex flex-col items-center justify-center text-center">
                <div className="relative mb-4">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
                  <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 backdrop-blur-sm">
                    <Upload className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  拖拽图片到此处，或点击选择
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  支持 JPG、PNG、WebP、BMP、GIF 等格式，可批量上传
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  className="gap-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  <ImageIcon className="h-4 w-4" />
                  选择图片
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 压缩设置 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardHeader
            className="pb-3 cursor-pointer select-none"
            onClick={() => setShowSettings(!showSettings)}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                压缩设置
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                {showSettings ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
          <AnimatePresence>
            {showSettings && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <CardContent className="pt-0 space-y-6">
                  {/* 质量滑块 */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground">压缩质量</span>
                      <Badge variant="outline" className="font-mono">
                        {quality}%
                      </Badge>
                    </div>
                    <Slider
                      value={[quality]}
                      onValueChange={handleQualityChange}
                      min={10}
                      max={100}
                      step={1}
                      disabled={isProcessing}
                      className="w-full"
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>体积最小</span>
                      <span>质量最佳</span>
                    </div>
                  </div>

                  {/* 质量说明 */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className={cn(
                      'rounded-lg p-2 border transition-colors',
                      quality <= 40
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground'
                    )}>
                      <div className="font-medium">低质量</div>
                      <div className="text-[10px] mt-0.5">体积最小</div>
                    </div>
                    <div className={cn(
                      'rounded-lg p-2 border transition-colors',
                      quality > 40 && quality <= 70
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground'
                    )}>
                      <div className="font-medium">中等</div>
                      <div className="text-[10px] mt-0.5">推荐 60-80%</div>
                    </div>
                    <div className={cn(
                      'rounded-lg p-2 border transition-colors',
                      quality > 70
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/50 text-muted-foreground'
                    )}>
                      <div className="font-medium">高质量</div>
                      <div className="text-[10px] mt-0.5">接近原图</div>
                    </div>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      </motion.div>

      {/* 进度条 */}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="space-y-2"
        >
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">正在处理...</span>
            <span className="font-medium text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </motion.div>
      )}

      {/* 统计摘要 */}
      {stats.doneCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="border border-primary/20 bg-gradient-to-r from-primary/5 via-purple-500/5 to-cyan-500/5 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-xs text-muted-foreground mb-1">已压缩</div>
                  <div className="text-lg font-bold text-foreground">
                    {stats.doneCount} 张
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">原始大小</div>
                  <div className="text-lg font-bold text-foreground">
                    {formatSize(stats.totalOriginal)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">压缩后</div>
                  <div className="text-lg font-bold text-primary">
                    {formatSize(stats.totalCompressed)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground mb-1">节省空间</div>
                  <div className="text-lg font-bold text-success">
                    {stats.ratio}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 文件列表 */}
      {items.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileImage className="h-4 w-4 text-primary" />
                文件列表
                <Badge variant="outline" className="text-xs font-normal ml-1">
                  共 {items.length} 张
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <AnimatePresence>
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, x: -20 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="flex items-center gap-4 p-3 rounded-xl border border-border/40 bg-card/40 backdrop-blur-sm hover:bg-card/60 transition-colors"
                    >
                      {/* 缩略图 */}
                      <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-muted/50 shrink-0 flex items-center justify-center">
                        {item.status === 'done' && item.compressedUrl ? (
                          <Image
                            src={item.compressedUrl}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                        )}
                        {item.status === 'processing' && (
                          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center">
                            <RefreshCw className="h-5 w-5 text-primary animate-spin" />
                          </div>
                        )}
                        {item.status === 'done' && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-success/90 flex items-center justify-center">
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                        {item.status === 'error' && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/90 flex items-center justify-center">
                            <X className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>

                      {/* 文件信息 */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm text-foreground truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {item.originalWidth} × {item.originalHeight}
                          </span>
                          <span>·</span>
                          <span>{formatSize(item.originalSize)}</span>
                          {item.compressedSize !== null && (
                            <>
                              <span>→</span>
                              <span className="text-primary font-medium">
                                {formatSize(item.compressedSize)}
                              </span>
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 border-success/30 bg-success/10 text-success"
                              >
                                -{getCompressRatio(item.originalSize, item.compressedSize)}%
                              </Badge>
                            </>
                          )}
                        </div>
                        {item.status === 'error' && item.error && (
                          <div className="text-xs text-destructive mt-1 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3" />
                            {item.error}
                          </div>
                        )}
                      </div>

                      {/* 操作按钮 */}
                      <div className="flex items-center gap-1 shrink-0">
                        {item.status === 'done' && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary"
                            onClick={() => handleDownload(item)}
                            aria-label="下载"
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => handleRemove(item.id)}
                          aria-label="删除"
                          disabled={isProcessing}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
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
              试用版最多处理 {trialLimits.imageMaxFiles} 张图片。激活后解锁无限制批量压缩。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
