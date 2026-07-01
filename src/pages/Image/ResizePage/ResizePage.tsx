import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Maximize2,
  Upload,
  X,
  Download,
  Image as ImageIcon,
  Lock,
  Unlock,
  Percent,
  Grid3X3,
  FileImage,
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  width: number;
  height: number;
  previewUrl: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  resultBlob?: Blob;
  resultSize?: number;
  resultWidth?: number;
  resultHeight?: number;
}

export default function ResizePage() {
  const { isTrial, trialLimits } = useLicense();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [mode, setMode] = useState<'pixel' | 'percent'>('pixel');
  const [width, setWidth] = useState<string>('1920');
  const [height, setHeight] = useState<string>('1080');
  const [percent, setPercent] = useState<string>('50');
  const [lockRatio, setLockRatio] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 计算第一张图片的原始宽高比（用于锁定比例） */
  const aspectRatio = useMemo(() => {
    const first = images.find((img) => img.width > 0);
    if (!first) return 16 / 9;
    return first.width / first.height;
  }, [images]);

  /** 当宽度变化且锁定比例时，自动计算高度 */
  const handleWidthChange = useCallback(
    (val: string) => {
      setWidth(val);
      if (lockRatio && mode === 'pixel') {
        const w = parseFloat(val);
        if (!isNaN(w) && w > 0) {
          setHeight(Math.round(w / aspectRatio).toString());
        }
      }
    },
    [lockRatio, mode, aspectRatio],
  );

  /** 当高度变化且锁定比例时，自动计算宽度 */
  const handleHeightChange = useCallback(
    (val: string) => {
      setHeight(val);
      if (lockRatio && mode === 'pixel') {
        const h = parseFloat(val);
        if (!isNaN(h) && h > 0) {
          setWidth(Math.round(h * aspectRatio).toString());
        }
      }
    },
    [lockRatio, mode, aspectRatio],
  );

  /** 处理文件选择 */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (fileArr.length === 0) {
        toast.error('请选择图片文件');
        return;
      }

      // 试用版限制
      if (isTrial) {
        const maxFiles = trialLimits.imageMaxFiles;
        const remaining = maxFiles - images.length;
        if (remaining <= 0) {
          toast.warning(`试用版最多处理 ${maxFiles} 张图片，激活后解锁无限制`);
          return;
        }
        if (fileArr.length > remaining) {
          toast.warning(`试用版最多处理 ${maxFiles} 张，仅添加前 ${remaining} 张`);
          fileArr.splice(remaining);
        }
      }

      const newImages: ImageItem[] = fileArr.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        width: 0,
        height: 0,
        previewUrl: URL.createObjectURL(file),
        status: 'pending',
      }));

      // 加载图片尺寸
      newImages.forEach((img) => {
        const el = new window.Image();
        el.onload = () => {
          setImages((prev) =>
            prev.map((i) =>
              i.id === img.id ? { ...i, width: el.naturalWidth, height: el.naturalHeight } : i,
            ),
          );
        };
        el.src = img.previewUrl;
      });

      setImages((prev) => [...prev, ...newImages]);
    },
    [images.length, isTrial, trialLimits.imageMaxFiles],
  );

  /** 拖拽事件 */
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

  /** 删除单张图片 */
  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  /** 清空全部 */
  const handleClear = useCallback(() => {
    images.forEach((img) => {
      if (img.previewUrl) URL.revokeObjectURL(img.previewUrl);
    });
    setImages([]);
    setProgress(0);
  }, [images]);

  /** 调整单张图片尺寸 */
  const resizeImage = useCallback(
    (imgItem: ImageItem): Promise<ImageItem> => {
      return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          let targetW: number;
          let targetH: number;

          if (mode === 'percent') {
            const p = parseFloat(percent) / 100;
            targetW = Math.round(img.naturalWidth * p);
            targetH = Math.round(img.naturalHeight * p);
          } else {
            targetW = parseInt(width, 10);
            targetH = parseInt(height, 10);
            if (lockRatio) {
              const ratio = img.naturalWidth / img.naturalHeight;
              if (targetW / targetH > ratio) {
                targetW = Math.round(targetH * ratio);
              } else {
                targetH = Math.round(targetW / ratio);
              }
            }
          }

          if (targetW < 1 || targetH < 1) {
            targetW = Math.max(1, targetW);
            targetH = Math.max(1, targetH);
          }

          const canvas = document.createElement('canvas');
          canvas.width = targetW;
          canvas.height = targetH;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 canvas 上下文'));
            return;
          }

          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, targetW, targetH);

          const ext = imgItem.file.type === 'image/png' ? 'png' : 'jpeg';
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('生成图片失败'));
                return;
              }
              resolve({
                ...imgItem,
                status: 'done',
                resultBlob: blob,
                resultSize: blob.size,
                resultWidth: targetW,
                resultHeight: targetH,
              });
            },
            imgItem.file.type === 'image/png' ? 'image/png' : 'image/jpeg',
            0.92,
          );
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = imgItem.previewUrl;
      });
    },
    [mode, percent, width, height, lockRatio],
  );

  /** 开始批量处理 */
  const handleStart = useCallback(async () => {
    if (images.length === 0) {
      toast.error('请先上传图片');
      return;
    }

    if (mode === 'pixel') {
      const w = parseInt(width, 10);
      const h = parseInt(height, 10);
      if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
        toast.error('请输入有效的宽高值');
        return;
      }
      if (w > 10000 || h > 10000) {
        toast.error('尺寸不能超过 10000 像素');
        return;
      }
    } else {
      const p = parseFloat(percent);
      if (isNaN(p) || p <= 0 || p > 500) {
        toast.error('请输入 1-500 之间的百分比');
        return;
      }
    }

    setProcessing(true);
    setProgress(0);
    setImages((prev) => prev.map((i) => ({ ...i, status: 'pending' })));

    const total = images.length;
    const results: ImageItem[] = [];

    for (let i = 0; i < images.length; i++) {
      const img = images[i];
      setImages((prev) => prev.map((item) => (item.id === img.id ? { ...item, status: 'processing' } : item)));

      try {
        const result = await resizeImage(img);
        results.push(result);
        setImages((prev) => prev.map((item) => (item.id === img.id ? result : item)));
      } catch {
        setImages((prev) =>
          prev.map((item) => (item.id === img.id ? { ...item, status: 'error' } : item)),
        );
      }

      setProgress(Math.round(((i + 1) / total) * 100));
    }

    setProcessing(false);
    const successCount = results.length;
    if (successCount > 0) {
      toast.success(`已完成 ${successCount} 张图片尺寸调整`);
    } else {
      toast.error('全部处理失败，请检查图片文件');
    }
  }, [images, mode, width, height, percent, lockRatio, resizeImage]);

  /** 下载单张 */
  const handleDownload = useCallback((item: ImageItem) => {
    if (!item.resultBlob) return;
    const url = URL.createObjectURL(item.resultBlob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = item.name.replace(/\.[^.]+$/, '');
    const ext = item.file.type === 'image/png' ? '.png' : '.jpg';
    a.download = `${baseName}_${item.resultWidth}x${item.resultHeight}${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, []);

  /** 批量下载 */
  const handleDownloadAll = useCallback(() => {
    const doneItems = images.filter((i) => i.status === 'done');
    if (doneItems.length === 0) {
      toast.error('没有可下载的文件');
      return;
    }
    doneItems.forEach((item, idx) => {
      setTimeout(() => handleDownload(item), idx * 200);
    });
    toast.success(`已开始下载 ${doneItems.length} 张图片`);
  }, [images, handleDownload]);

  /** 格式化文件大小 */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const doneCount = images.filter((i) => i.status === 'done').length;

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
              <Maximize2 className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">尺寸调整</h1>
            <p className="text-sm text-muted-foreground">
              按像素或百分比调整图片尺寸，支持批量处理
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {doneCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleDownloadAll} className="gap-2">
              <Download className="h-4 w-4" />
              全部下载 ({doneCount})
            </Button>
          )}
          {images.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleClear} className="gap-2 text-muted-foreground">
              <Trash2 className="h-4 w-4" />
              清空
            </Button>
          )}
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 最多 {trialLimits.imageMaxFiles} 张
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：参数设置 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-4"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Grid3X3 className="h-5 w-5 text-primary" />
                尺寸设置
              </CardTitle>
              <CardDescription className="text-xs">
                选择调整方式，设置目标尺寸
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 模式切换 */}
              <Tabs value={mode} onValueChange={(v) => setMode(v as 'pixel' | 'percent')} className="w-full">
                <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                  <TabsTrigger value="pixel" className="text-sm">
                    像素
                  </TabsTrigger>
                  <TabsTrigger value="percent" className="text-sm">
                    百分比
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* 像素模式 */}
              {mode === 'pixel' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="width" className="text-sm">
                        宽度 (px)
                      </Label>
                      <Input
                        id="width"
                        type="number"
                        value={width}
                        onChange={(e) => handleWidthChange(e.target.value)}
                        className="bg-background/50 border-border/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height" className="text-sm">
                        高度 (px)
                      </Label>
                      <Input
                        id="height"
                        type="number"
                        value={height}
                        onChange={(e) => handleHeightChange(e.target.value)}
                        className="bg-background/50 border-border/50"
                      />
                    </div>
                  </div>

                  {/* 锁定比例 */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/30 px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {lockRatio ? (
                        <Lock className="h-4 w-4 text-primary" />
                      ) : (
                        <Unlock className="h-4 w-4 text-muted-foreground" />
                      )}
                      <span className="text-sm">锁定宽高比</span>
                    </div>
                    <Switch checked={lockRatio} onCheckedChange={setLockRatio} />
                  </div>

                  {/* 常用尺寸快捷选择 */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">常用尺寸</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { w: 1920, h: 1080, label: '1080P' },
                        { w: 2560, h: 1440, label: '2K' },
                        { w: 3840, h: 2160, label: '4K' },
                        { w: 1280, h: 720, label: '720P' },
                        { w: 800, h: 600, label: '800×600' },
                        { w: 1080, h: 1920, label: '手机竖屏' },
                      ].map((s) => (
                        <button
                          key={s.label}
                          onClick={() => {
                            setWidth(s.w.toString());
                            setHeight(s.h.toString());
                          }}
                          className={cn(
                            'px-2 py-1.5 text-xs rounded-md transition-colors',
                            width === s.w.toString() && height === s.h.toString()
                              ? 'bg-primary/15 text-primary font-medium'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                          )}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* 百分比模式 */}
              {mode === 'percent' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="percent" className="text-sm">
                        缩放比例
                      </Label>
                      <span className="text-sm font-medium text-primary">{percent}%</span>
                    </div>
                    <div className="relative">
                      <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="percent"
                        type="number"
                        value={percent}
                        onChange={(e) => setPercent(e.target.value)}
                        className="pl-10 bg-background/50 border-border/50"
                      />
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="200"
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                      className="w-full h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
                    />
                  </div>

                  <div className="grid grid-cols-4 gap-2">
                    {['25', '50', '75', '100', '125', '150', '175', '200'].map((p) => (
                      <button
                        key={p}
                        onClick={() => setPercent(p)}
                        className={cn(
                          'px-2 py-1.5 text-xs rounded-md transition-colors',
                          percent === p
                            ? 'bg-primary/15 text-primary font-medium'
                            : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {p}%
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 开始按钮 */}
              <Button
                onClick={handleStart}
                disabled={processing || images.length === 0}
                className="w-full h-11 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
              >
                {processing ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    处理中 {progress}%
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4" />
                    开始调整尺寸
                  </span>
                )}
              </Button>

              {processing && <Progress value={progress} className="h-1.5" />}
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：上传区 + 文件列表 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* 上传区 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardContent className="p-0">
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'relative cursor-pointer rounded-xl border-2 border-dashed p-8 transition-all duration-300',
                  'flex flex-col items-center justify-center min-h-[200px]',
                  isDragging
                    ? 'border-primary bg-primary/10 scale-[1.01]'
                    : 'border-border/60 hover:border-primary/50 hover:bg-primary/5',
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

                <div className="relative mb-4">
                  <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
                  <div className="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary">
                    <Upload className="h-7 w-7" />
                  </div>
                </div>

                <p className="text-base font-medium text-foreground mb-1">
                  拖拽图片到此处，或点击选择
                </p>
                <p className="text-sm text-muted-foreground">
                  支持 JPG、PNG、WebP、BMP、GIF 等格式，可批量上传
                </p>

                {isTrial && (
                  <div className="mt-3 flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span>试用版最多处理 {trialLimits.imageMaxFiles} 张图片</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 图片列表 */}
          <AnimatePresence>
            {images.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <FileImage className="h-4 w-4 text-primary" />
                      图片列表
                      <Badge variant="outline" className="text-xs font-normal ml-1">
                        {images.length} 张
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                      {images.map((img, idx) => (
                        <motion.div
                          key={img.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.25, delay: idx * 0.03 }}
                          className="flex items-center gap-3 p-3 rounded-xl bg-background/40 border border-border/30 hover:border-primary/30 transition-all group"
                        >
                          {/* 缩略图 */}
                          <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-muted/50">
                            <Image
                              src={img.previewUrl}
                              alt={img.name}
                              className="w-full h-full object-cover"
                              width={56}
                              height={56}
                            />
                            {img.status === 'processing' && (
                              <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                                <Loader2 className="h-5 w-5 text-primary animate-spin" />
                              </div>
                            )}
                            {img.status === 'done' && (
                              <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-success" />
                              </div>
                            )}
                          </div>

                          {/* 信息 */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">
                              {img.name}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                              <span>{formatSize(img.size)}</span>
                              {img.width > 0 && (
                                <span>
                                  {img.width} × {img.height}
                                </span>
                              )}
                              {img.status === 'done' && img.resultSize !== undefined && (
                                <>
                                  <span className="text-border">→</span>
                                  <span className="text-success">
                                    {formatSize(img.resultSize)}
                                  </span>
                                  <span className="text-success">
                                    {img.resultWidth} × {img.resultHeight}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex items-center gap-1 shrink-0">
                            {img.status === 'done' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDownload(img)}
                                className="h-8 w-8 text-primary hover:text-primary hover:bg-primary/10"
                                aria-label="下载"
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemove(img.id)}
                              disabled={processing}
                              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                              aria-label="删除"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 空状态 */}
          {images.length === 0 && (
            <Card className="border border-white/20 bg-white/40 backdrop-blur-xl dark:bg-slate-900/30 dark:border-white/10">
              <CardContent className="p-12 text-center">
                <ImageIcon className="h-14 w-14 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">上传图片后开始调整尺寸</p>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </div>
    </div>
  );
}
