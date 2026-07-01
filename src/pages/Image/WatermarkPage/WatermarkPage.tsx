import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sticker,
  Upload,
  X,
  Download,
  Type,
  Palette,
  Move,
  Percent,
  Image as ImageIcon,
  Trash2,
  Check,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

/** 水印位置（九宫格） */
const POSITIONS = [
  { key: 'top-left', label: '左上', col: 0, row: 0 },
  { key: 'top-center', label: '上中', col: 1, row: 0 },
  { key: 'top-right', label: '右上', col: 2, row: 0 },
  { key: 'middle-left', label: '左中', col: 0, row: 1 },
  { key: 'center', label: '居中', col: 1, row: 1 },
  { key: 'middle-right', label: '右中', col: 2, row: 1 },
  { key: 'bottom-left', label: '左下', col: 0, row: 2 },
  { key: 'bottom-center', label: '下中', col: 1, row: 2 },
  { key: 'bottom-right', label: '右下', col: 2, row: 2 },
];

/** 预设颜色 */
const PRESET_COLORS = [
  '#ffffff',
  '#000000',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#06b6d4',
  '#3b82f6',
  '#8b5cf6',
  '#ec4899',
];

interface ImageItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  width: number;
  height: number;
  resultUrl?: string;
  processing?: boolean;
}

export default function WatermarkPage() {
  const { isTrial, trialLimits } = useLicense();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 水印参数
  const [watermarkText, setWatermarkText] = useState('水印文字');
  const [fontSize, setFontSize] = useState(32);
  const [opacity, setOpacity] = useState(50);
  const [position, setPosition] = useState('bottom-right');
  const [color, setColor] = useState('#ffffff');
  const [rotation, setRotation] = useState(0);
  const [margin, setMargin] = useState(20);
  const [tileMode, setTileMode] = useState<'single' | 'tile'>('single');

  /** 格式化文件大小 */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /** 处理文件上传 */
  const handleFiles = useCallback(
    (files: FileList | File[]) => {
      const fileArr = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (fileArr.length === 0) {
        toast.error('请选择图片文件');
        return;
      }

      const maxFiles = isTrial ? trialLimits.imageMaxFiles : 100;
      if (images.length + fileArr.length > maxFiles) {
        toast.warning(
          isTrial
            ? `试用版最多处理 ${maxFiles} 张图片，激活后无限制`
            : `最多支持 ${maxFiles} 张图片`,
        );
      }

      const toAdd = fileArr.slice(0, maxFiles - images.length);

      const newItems: ImageItem[] = toAdd.map((file) => ({
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        width: 0,
        height: 0,
      }));

      // 加载图片尺寸
      newItems.forEach((item) => {
        const img = new window.Image();
        img.onload = () => {
          setImages((prev) =>
            prev.map((i) =>
              i.id === item.id ? { ...i, width: img.width, height: img.height } : i,
            ),
          );
        };
        img.src = item.previewUrl;
      });

      setImages((prev) => [...prev, ...newItems]);
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
      if (e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles],
  );

  /** 删除单张图片 */
  const handleRemove = useCallback((id: string) => {
    setImages((prev) => {
      const item = prev.find((i) => i.id === id);
      if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  /** 清空全部 */
  const handleClear = useCallback(() => {
    images.forEach((i) => {
      if (i.previewUrl) URL.revokeObjectURL(i.previewUrl);
      if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
    });
    setImages([]);
  }, [images]);

  /** 计算水印位置坐标 */
  const calcWatermarkPosition = (
    imgWidth: number,
    imgHeight: number,
    textWidth: number,
    textHeight: number,
    posKey: string,
    m: number,
  ): { x: number; y: number } => {
    const pos = POSITIONS.find((p) => p.key === posKey) ?? POSITIONS[8];
    let x = m;
    let y = m + textHeight;

    if (pos.col === 1) x = (imgWidth - textWidth) / 2;
    else if (pos.col === 2) x = imgWidth - textWidth - m;

    if (pos.row === 1) y = (imgHeight + textHeight) / 2;
    else if (pos.row === 2) y = imgHeight - m;

    return { x, y };
  };

  /** 生成带水印的图片 */
  const applyWatermark = useCallback(
    (item: ImageItem): Promise<string> => {
      return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('无法创建 Canvas 上下文'));
            return;
          }

          canvas.width = img.width;
          canvas.height = img.height;
          ctx.drawImage(img, 0, 0);

          ctx.globalAlpha = opacity / 100;
          ctx.font = `bold ${fontSize}px Arial, sans-serif`;
          ctx.fillStyle = color;
          ctx.textBaseline = 'alphabetic';

          const textMetrics = ctx.measureText(watermarkText || '水印');
          const textWidth = textMetrics.width;
          const textHeight = fontSize;

          if (tileMode === 'tile') {
            // 平铺模式
            const stepX = textWidth * 2;
            const stepY = textHeight * 4;
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((rotation * Math.PI) / 180);
            const diag = Math.sqrt(canvas.width ** 2 + canvas.height ** 2);
            for (let y = -diag; y < diag; y += stepY) {
              for (let x = -diag; x < diag; x += stepX) {
                ctx.fillText(watermarkText || '水印', x, y);
              }
            }
            ctx.restore();
          } else {
            // 单位置模式
            ctx.save();
            if (rotation !== 0) {
              const { x, y } = calcWatermarkPosition(
                canvas.width,
                canvas.height,
                textWidth,
                textHeight,
                position,
                margin,
              );
              ctx.translate(x + textWidth / 2, y - textHeight / 2);
              ctx.rotate((rotation * Math.PI) / 180);
              ctx.fillText(watermarkText || '水印', -textWidth / 2, textHeight / 2);
            } else {
              const { x, y } = calcWatermarkPosition(
                canvas.width,
                canvas.height,
                textWidth,
                textHeight,
                position,
                margin,
              );
              ctx.fillText(watermarkText || '水印', x, y);
            }
            ctx.restore();
          }

          ctx.globalAlpha = 1;
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error('图片加载失败'));
        img.src = item.previewUrl;
      });
    },
    [watermarkText, fontSize, opacity, position, color, rotation, margin, tileMode],
  );

  /** 批量添加水印 */
  const handleProcess = useCallback(async () => {
    if (images.length === 0) return;
    if (!watermarkText.trim()) {
      toast.error('请输入水印文字');
      return;
    }

    setProcessing(true);
    setProgress(0);

    try {
      const results: ImageItem[] = [];
      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        const resultUrl = await applyWatermark(item);
        results.push({ ...item, resultUrl });
        setProgress(Math.round(((i + 1) / images.length) * 100));
      }
      setImages(results);
      toast.success(`已为 ${images.length} 张图片添加水印`);
    } catch (err) {
      toast.error('处理失败：' + (err as Error).message);
    } finally {
      setProcessing(false);
    }
  }, [images, watermarkText, applyWatermark]);

  /** 下载单张 */
  const handleDownload = useCallback((item: ImageItem) => {
    if (!item.resultUrl) return;
    const a = document.createElement('a');
    a.href = item.resultUrl;
    const baseName = item.name.replace(/\.[^.]+$/, '');
    a.download = `${baseName}_水印.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  /** 下载全部 */
  const handleDownloadAll = useCallback(() => {
    const processed = images.filter((i) => i.resultUrl);
    if (processed.length === 0) return;

    processed.forEach((item, idx) => {
      setTimeout(() => handleDownload(item), idx * 200);
    });
    toast.success(`开始下载 ${processed.length} 张图片`);
  }, [images, handleDownload]);

  /** 重置结果 */
  const handleReset = useCallback(() => {
    setImages((prev) =>
      prev.map((i) => {
        if (i.resultUrl) URL.revokeObjectURL(i.resultUrl);
        return { ...i, resultUrl: undefined };
      }),
    );
    setProgress(0);
  }, []);

  /** 预览图（第一张用于实时预览水印效果） */
  const previewImage = images[0];

  /** 实时预览水印效果（CSS 模拟） */
  const watermarkStyle = useMemo<React.CSSProperties>(() => {
    const pos = POSITIONS.find((p) => p.key === position) ?? POSITIONS[8];
    const style: React.CSSProperties = {
      opacity: opacity / 100,
      fontSize: `${fontSize * 0.3}px`,
      color,
      transform: `rotate(${rotation}deg)`,
      fontWeight: 'bold',
      textShadow: '0 1px 2px rgba(0,0,0,0.3)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    };

    if (tileMode === 'tile') {
      return {
        ...style,
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexWrap: 'wrap',
        alignContent: 'space-evenly',
        justifyContent: 'space-evenly',
        gap: '20px',
        fontSize: `${fontSize * 0.2}px`,
        transform: `rotate(${rotation}deg)`,
      };
    }

    // 单位置
    const positionClasses: Record<string, string> = {};
    let top = 'auto';
    let left = 'auto';
    let right = 'auto';
    let bottom = 'auto';
    let transformVal = `translate(0, 0) rotate(${rotation}deg)`;

    if (pos.row === 0) top = `${margin * 0.3}px`;
    else if (pos.row === 1) top = '50%';
    else bottom = `${margin * 0.3}px`;

    if (pos.col === 0) left = `${margin * 0.3}px`;
    else if (pos.col === 1) left = '50%';
    else right = `${margin * 0.3}px`;

    if (pos.row === 1 && pos.col === 1) {
      transformVal = `translate(-50%, -50%) rotate(${rotation}deg)`;
    } else if (pos.row === 1) {
      transformVal = `translateY(-50%) rotate(${rotation}deg)`;
    } else if (pos.col === 1) {
      transformVal = `translateX(-50%) rotate(${rotation}deg)`;
    }

    return {
      ...style,
      position: 'absolute',
      top,
      left,
      right,
      bottom,
      transform: transformVal,
    };
  }, [position, opacity, fontSize, color, rotation, margin, tileMode]);

  const hasResults = images.some((i) => i.resultUrl);

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
              <Sticker className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">文字水印</h1>
            <p className="text-sm text-muted-foreground">
              为图片添加自定义文字水印，支持 9 宫格位置 / 平铺 / 批量处理
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasResults && (
            <>
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                重新处理
              </Button>
              <Button
                onClick={handleDownloadAll}
                size="sm"
                className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
              >
                <Download className="h-4 w-4" />
                下载全部
              </Button>
            </>
          )}
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 最多 {trialLimits.imageMaxFiles} 张
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 左侧：上传区 + 图片列表 */}
        <div className="lg:col-span-2 space-y-4">
          {/* 上传区 */}
          {images.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card
                className={cn(
                  'border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden',
                  isDragging
                    ? 'border-primary bg-primary/10 scale-[1.01]'
                    : 'border-white/20 bg-white/60 hover:border-primary/50 hover:bg-primary/5 dark:bg-slate-900/50 dark:border-white/10',
                )}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <CardContent className="flex flex-col items-center justify-center py-16 px-6">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
                    <div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-600/20 flex items-center justify-center">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    拖拽图片到此处，或点击选择
                  </h3>
                  <p className="text-sm text-muted-foreground mb-4 text-center">
                    支持 JPG、PNG、WebP、BMP、GIF 等格式，批量上传
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                  >
                    <ImageIcon className="h-4 w-4" />
                    选择图片
                  </Button>
                  {isTrial && (
                    <p className="text-xs text-muted-foreground mt-4">
                      试用版最多 {trialLimits.imageMaxFiles} 张，激活后无限制
                    </p>
                  )}
                </CardContent>
              </Card>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </motion.div>
          )}

          {/* 图片列表 */}
          {images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
                <CardHeader className="pb-3 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-semibold">
                      图片列表
                      <Badge variant="outline" className="ml-2 text-xs font-normal">
                        {images.length} 张
                      </Badge>
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      className="gap-1"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      添加
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleClear}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      清空
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    <AnimatePresence>
                      {images.map((item, idx) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          transition={{ duration: 0.2, delay: idx * 0.03 }}
                          className="relative group rounded-lg overflow-hidden border border-border/40 bg-card/50"
                        >
                          <div className="relative aspect-square overflow-hidden">
                            <Image
                              src={item.resultUrl || item.previewUrl}
                              alt={item.name}
                              className="w-full h-full object-cover"
                            />
                            {item.resultUrl && (
                              <div className="absolute top-2 left-2">
                                <Badge className="bg-success/90 text-white text-[10px] h-5">
                                  <Check className="h-3 w-3 mr-0.5" />
                                  已处理
                                </Badge>
                              </div>
                            )}
                            <button
                              onClick={() => handleRemove(item.id)}
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-destructive/90 text-white rounded-full p-1 hover:bg-destructive"
                              aria-label="删除"
                            >
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="p-2">
                            <p className="text-xs font-medium text-foreground truncate" title={item.name}>
                              {item.name}
                            </p>
                            <div className="flex items-center justify-between mt-0.5">
                              <span className="text-[10px] text-muted-foreground">
                                {formatSize(item.size)}
                              </span>
                              {item.resultUrl && (
                                <button
                                  onClick={() => handleDownload(item)}
                                  className="text-[10px] text-primary hover:text-primary/80 flex items-center gap-0.5"
                                >
                                  <Download className="h-3 w-3" />
                                  下载
                                </button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </CardContent>
              </Card>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </motion.div>
          )}

          {/* 处理进度 */}
          {processing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="overflow-hidden"
            >
              <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">正在添加水印...</span>
                    <span className="text-sm text-primary font-mono">{progress}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-primary to-purple-600 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>

        {/* 右侧：参数设置 */}
        <div className="space-y-4">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Type className="h-5 w-5 text-primary" />
                  水印设置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* 水印文字 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">水印文字</Label>
                  <Input
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="请输入水印文字"
                    maxLength={50}
                    className="bg-background/50"
                  />
                  <p className="text-xs text-muted-foreground text-right">
                    {watermarkText.length}/50
                  </p>
                </div>

                {/* 模式切换 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">水印模式</Label>
                  <Tabs
                    value={tileMode}
                    onValueChange={(v) => setTileMode(v as 'single' | 'tile')}
                    className="w-full"
                  >
                    <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                      <TabsTrigger value="single" className="text-sm">
                        单个位置
                      </TabsTrigger>
                      <TabsTrigger value="tile" className="text-sm">
                        平铺
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* 位置选择（九宫格） */}
                {tileMode === 'single' && (
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Move className="h-3.5 w-3.5" />
                      水印位置
                    </Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {POSITIONS.map((pos) => (
                        <button
                          key={pos.key}
                          onClick={() => setPosition(pos.key)}
                          className={cn(
                            'h-10 rounded-lg text-xs font-medium transition-all duration-200',
                            position === pos.key
                              ? 'bg-primary text-white shadow-md shadow-primary/30'
                              : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground',
                          )}
                        >
                          {pos.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 字体大小 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Type className="h-3.5 w-3.5" />
                      字号
                    </Label>
                    <span className="text-sm text-primary font-mono">{fontSize}px</span>
                  </div>
                  <Slider
                    value={[fontSize]}
                    onValueChange={([v]) => setFontSize(v)}
                    min={12}
                    max={120}
                    step={1}
                    className="py-1"
                  />
                </div>

                {/* 透明度 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      <Percent className="h-3.5 w-3.5" />
                      透明度
                    </Label>
                    <span className="text-sm text-primary font-mono">{opacity}%</span>
                  </div>
                  <Slider
                    value={[opacity]}
                    onValueChange={([v]) => setOpacity(v)}
                    min={5}
                    max={100}
                    step={1}
                    className="py-1"
                  />
                </div>

                {/* 旋转角度 */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">旋转角度</Label>
                    <span className="text-sm text-primary font-mono">{rotation}°</span>
                  </div>
                  <Slider
                    value={[rotation]}
                    onValueChange={([v]) => setRotation(v)}
                    min={-90}
                    max={90}
                    step={1}
                    className="py-1"
                  />
                </div>

                {/* 边距 */}
                {tileMode === 'single' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-medium">边距</Label>
                      <span className="text-sm text-primary font-mono">{margin}px</span>
                    </div>
                    <Slider
                      value={[margin]}
                      onValueChange={([v]) => setMargin(v)}
                      min={5}
                      max={100}
                      step={1}
                      className="py-1"
                    />
                  </div>
                )}

                {/* 颜色选择 */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Palette className="h-3.5 w-3.5" />
                    文字颜色
                  </Label>
                  <div className="flex items-center gap-2 flex-wrap">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setColor(c)}
                        className={cn(
                          'w-7 h-7 rounded-full border-2 transition-all duration-200 hover:scale-110',
                          color === c
                            ? 'border-primary ring-2 ring-primary/30 scale-110'
                            : 'border-border/50',
                        )}
                        style={{ backgroundColor: c }}
                        aria-label={`颜色 ${c}`}
                      />
                    ))}
                    <div className="relative">
                      <input
                        type="color"
                        value={color}
                        onChange={(e) => setColor(e.target.value)}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                      <div
                        className="w-7 h-7 rounded-full border-2 border-dashed border-border/50 flex items-center justify-center"
                        style={{ background: `conic-gradient(red, yellow, lime, aqua, blue, magenta, red)` }}
                      >
                        <div className="w-3 h-3 rounded-full bg-white" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 开始处理按钮 */}
                <Button
                  onClick={handleProcess}
                  disabled={images.length === 0 || processing || !watermarkText.trim()}
                  className="w-full h-11 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
                >
                  {processing ? (
                    <span className="flex items-center gap-2">
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      处理中 {progress}%
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Sticker className="h-4 w-4" />
                      开始添加水印
                    </span>
                  )}
                </Button>
              </CardContent>
            </Card>
          </motion.div>

          {/* 实时预览 */}
          {previewImage && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">实时预览</CardTitle>
                  <CardDescription className="text-xs">
                    调整参数后预览水印效果
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="relative rounded-lg overflow-hidden bg-muted/30">
                    <Image
                      src={previewImage.previewUrl}
                      alt="预览"
                      className="w-full h-auto"
                    />
                    <div style={watermarkStyle}>
                      {tileMode === 'tile' ? (
                        <div className="w-full h-full flex flex-wrap content-center justify-center gap-8">
                          {Array.from({ length: 12 }).map((_, i) => (
                            <span key={i}>{watermarkText || '水印'}</span>
                          ))}
                        </div>
                      ) : (
                        watermarkText || '水印'
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 试用版提示 */}
          {isTrial && images.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.25 }}
              className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-start gap-3"
            >
              <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">试用版</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  试用版最多处理 {trialLimits.imageMaxFiles} 张图片。激活后解锁无限制批量处理。
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
