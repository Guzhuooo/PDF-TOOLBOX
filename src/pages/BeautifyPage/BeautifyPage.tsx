import { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Download,
  Image as ImageIcon,
  Palette,
  CircleDot,
  Square,
  Droplets,
  Upload,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { useLicense } from '@/contexts/LicenseContext';
import {
  generateQrCode,
  exportAsPng,
  exportAsSvg,
  type QrStyle,
  type QrErrorLevel,
  type FinderPatternStyle,
} from '@/utils/qr-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

const STYLE_OPTIONS: { value: QrStyle; label: string; icon: typeof Square; desc: string }[] = [
  { value: 'classic', label: '经典', icon: Square, desc: '标准方块' },
  { value: 'dots', label: '圆点', icon: CircleDot, desc: '圆点像素' },
  { value: 'squares', label: '方块', icon: Square, desc: '圆角方块' },
  { value: 'liquid', label: '液态', icon: Droplets, desc: '流体融合' },
];

const FINDER_OPTIONS: { value: FinderPatternStyle; label: string }[] = [
  { value: 'square', label: '方形' },
  { value: 'rounded', label: '圆角' },
  { value: 'circle', label: '圆形' },
];

const ERROR_LEVELS: { value: QrErrorLevel; label: string; desc: string }[] = [
  { value: 'L', label: 'L - 低', desc: '7% 容错' },
  { value: 'M', label: 'M - 中', desc: '15% 容错' },
  { value: 'Q', label: 'Q - 较高', desc: '25% 容错' },
  { value: 'H', label: 'H - 高', desc: '30% 容错' },
];

export default function BeautifyPage() {
  const { isTrial, trialLimits } = useLicense();
  const [content, setContent] = useState('https://example.com');
  const [size, setSize] = useState(400);
  const [errorLevel, setErrorLevel] = useState<QrErrorLevel>('H');
  const [style, setStyle] = useState<QrStyle>('classic');
  const [finderPattern, setFinderPattern] = useState<FinderPatternStyle>('square');
  const [foreground, setForeground] = useState('#1e1b4b');
  const [background, setBackground] = useState('#ffffff');
  const [finderColor, setFinderColor] = useState('#4f46e5');
  const [useGradient, setUseGradient] = useState(true);
  const [gradientStart, setGradientStart] = useState('#6366f1');
  const [gradientEnd, setGradientEnd] = useState('#a855f7');
  const [gradientAngle, setGradientAngle] = useState(135);
  const [useFinderColor, setUseFinderColor] = useState(true);
  const [margin, setMargin] = useState(4);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState<'png' | 'svg'>('png');
  const previewRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const generatePreview = useCallback(async () => {
    if (!content.trim()) return;
    setIsGenerating(true);
    try {
      const result = await generateQrCode({
        content: content.trim(),
        size,
        errorLevel,
        foreground,
        background,
        margin,
        style,
        useGradient,
        gradientStart,
        gradientEnd,
        gradientAngle,
        finderPattern,
        finderColor: useFinderColor ? finderColor : foreground,
        logoImage: null,
        logoRatio: 0.2,
        logoRadius: 8,
        logoBgColor: '#ffffff',
        addWatermark: isTrial && trialLimits.addWatermark,
        watermarkText: '试用版',
      });
      canvasRef.current = result.canvas;
      setPreviewUrl(result.dataUrl);
    } catch (error) {
      logger.error('QR beautify generate failed:', String(error));
      toast.error('生成失败，请检查内容是否有效');
    } finally {
      setIsGenerating(false);
    }
  }, [
    content,
    size,
    errorLevel,
    style,
    finderPattern,
    foreground,
    background,
    finderColor,
    useGradient,
    gradientStart,
    gradientEnd,
    gradientAngle,
    useFinderColor,
    margin,
    isTrial,
    trialLimits.addWatermark,
  ]);

  useEffect(() => {
    const timer = setTimeout(() => {
      generatePreview();
    }, 300);
    return () => clearTimeout(timer);
  }, [generatePreview]);

  const handleDownload = useCallback(async () => {
    if (!canvasRef.current) {
      toast.error('请先生成二维码');
      return;
    }
    const fileName = `qr_beautified_${Date.now()}`;
    if (downloadFormat === 'png') {
      exportAsPng(canvasRef.current, `${fileName}.png`);
    } else {
      await exportAsSvg(
        content,
        size,
        foreground,
        background,
        errorLevel,
        margin,
        `${fileName}.svg`
      );
    }
    toast.success(`二维码已下载（${downloadFormat.toUpperCase()}）`);
  }, [downloadFormat, content, size, foreground, background, errorLevel, margin]);

  const handleCopyContent = useCallback(async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      toast.success('内容已复制到剪贴板');
    } catch {
      toast.error('复制失败');
    }
  }, [content]);

  const handleRandomGradient = useCallback(() => {
    const palettes = [
      { start: '#6366f1', end: '#a855f7' },
      { start: '#06b6d4', end: '#3b82f6' },
      { start: '#10b981', end: '#06b6d4' },
      { start: '#f59e0b', end: '#ef4444' },
      { start: '#ec4899', end: '#8b5cf6' },
      { start: '#14b8a6', end: '#6366f1' },
    ];
    const p = palettes[Math.floor(Math.random() * palettes.length)];
    setGradientStart(p.start);
    setGradientEnd(p.end);
    setGradientAngle(Math.floor(Math.random() * 360));
  }, []);

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* 页面标题 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="mb-6 flex items-center gap-3"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-purple-500 text-primary-foreground shadow-lg shadow-primary/20">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            二维码美化
          </h1>
          <p className="text-sm text-muted-foreground">
            自定义样式、渐变色、定位点，打造专属二维码
          </p>
        </div>
        {isTrial && (
          <Badge
            variant="outline"
            className="ml-auto gap-1 border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
            试用版
          </Badge>
        )}
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        {/* 左侧：参数设置 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="space-y-6"
        >
          {/* 内容输入 */}
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">二维码内容</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="输入文本、网址、联系方式等内容..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border/60 bg-background/50 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  className="!absolute right-2 top-2 h-7 w-7 text-muted-foreground hover:text-foreground"
                  onClick={handleCopyContent}
                  aria-label="复制内容"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>字符数：{content.length}</span>
                <span>内容越多，二维码越复杂</span>
              </div>
            </CardContent>
          </Card>

          {/* 样式模板 */}
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">样式模板</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-2">
                {STYLE_OPTIONS.map((s) => {
                  const Icon = s.icon;
                  const active = style === s.value;
                  return (
                    <button
                      key={s.value}
                      onClick={() => setStyle(s.value)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-200',
                        active
                          ? 'border-primary/50 bg-primary/10 text-primary shadow-sm'
                          : 'border-border/40 bg-background/30 text-muted-foreground hover:border-border/70 hover:bg-background/50 hover:text-foreground'
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-medium">{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 颜色设置 */}
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Palette className="h-4 w-4 text-primary" />
                颜色设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 渐变色开关 */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    渐变色
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    使用渐变色填充二维码
                  </p>
                </div>
                <Switch checked={useGradient} onCheckedChange={setUseGradient} />
              </div>

              {useGradient ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        起始色
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={gradientStart}
                          onChange={(e) => setGradientStart(e.target.value)}
                          className="h-9 w-9 cursor-pointer rounded-md border border-border/40 bg-background"
                        />
                        <Input
                          value={gradientStart}
                          onChange={(e) => setGradientStart(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        结束色
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={gradientEnd}
                          onChange={(e) => setGradientEnd(e.target.value)}
                          className="h-9 w-9 cursor-pointer rounded-md border border-border/40 bg-background"
                        />
                        <Input
                          value={gradientEnd}
                          onChange={(e) => setGradientEnd(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs text-muted-foreground">
                        渐变角度
                      </Label>
                      <span className="text-xs font-medium text-foreground">
                        {gradientAngle}°
                      </span>
                    </div>
                    <Slider
                      value={[gradientAngle]}
                      onValueChange={(v) => setGradientAngle(v[0])}
                      min={0}
                      max={360}
                      step={1}
                      className="py-1"
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRandomGradient}
                    className="w-full gap-1.5"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    随机配色
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        前景色
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={foreground}
                          onChange={(e) => setForeground(e.target.value)}
                          className="h-9 w-9 cursor-pointer rounded-md border border-border/40 bg-background"
                        />
                        <Input
                          value={foreground}
                          onChange={(e) => setForeground(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">
                        背景色
                      </Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={background}
                          onChange={(e) => setBackground(e.target.value)}
                          className="h-9 w-9 cursor-pointer rounded-md border border-border/40 bg-background"
                        />
                        <Input
                          value={background}
                          onChange={(e) => setBackground(e.target.value)}
                          className="h-9 font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 定位点设置 */}
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">定位点样式</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm text-foreground">形状</Label>
                <div className="grid grid-cols-3 gap-2">
                  {FINDER_OPTIONS.map((f) => (
                    <button
                      key={f.value}
                      onClick={() => setFinderPattern(f.value)}
                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                        finderPattern === f.value
                          ? 'border-primary/50 bg-primary/10 text-primary'
                          : 'border-border/40 bg-background/30 text-muted-foreground hover:border-border/70 hover:text-foreground'
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-foreground">
                    独立定位点颜色
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    让三个定位角使用不同颜色
                  </p>
                </div>
                <Switch
                  checked={useFinderColor}
                  onCheckedChange={setUseFinderColor}
                />
              </div>

              {useFinderColor && (
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">
                    定位点颜色
                  </Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={finderColor}
                      onChange={(e) => setFinderColor(e.target.value)}
                      className="h-9 w-9 cursor-pointer rounded-md border border-border/40 bg-background"
                    />
                    <Input
                      value={finderColor}
                      onChange={(e) => setFinderColor(e.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 基础参数 */}
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">基础参数</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-foreground">尺寸</Label>
                  <span className="text-sm font-medium text-primary">
                    {size}px
                  </span>
                </div>
                <Slider
                  value={[size]}
                  onValueChange={(v) => setSize(v[0])}
                  min={100}
                  max={1000}
                  step={10}
                  className="py-1"
                />
                <div className="flex justify-between text-[11px] text-muted-foreground/70">
                  <span>100px</span>
                  <span>1000px</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-sm text-foreground">容错级别</Label>
                <Select
                  value={errorLevel}
                  onValueChange={(v) => setErrorLevel(v as QrErrorLevel)}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ERROR_LEVELS.map((el) => (
                      <SelectItem key={el.value} value={el.value}>
                        <div className="flex items-center justify-between gap-4">
                          <span className="font-medium">{el.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {el.desc}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-foreground">边距</Label>
                  <span className="text-sm font-medium text-primary">
                    {margin} 模块
                  </span>
                </div>
                <Slider
                  value={[margin]}
                  onValueChange={(v) => setMargin(v[0])}
                  min={0}
                  max={10}
                  step={1}
                  className="py-1"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：实时预览 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-6"
        >
          {/* 预览卡片 */}
          <Card className="sticky top-4 border-white/20 bg-white/40 backdrop-blur-xl shadow-xl shadow-primary/5 dark:border-white/10 dark:bg-background/30">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <ImageIcon className="h-4 w-4 text-primary" />
                实时预览
                {isGenerating && (
                  <span className="ml-auto text-xs font-normal text-muted-foreground">
                    生成中...
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                ref={previewRef}
                className="relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-border/30 bg-gradient-to-br from-muted/30 to-background/50"
              >
                {previewUrl ? (
                  <motion.div
                    key={previewUrl}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <Image
                      src={previewUrl}
                      alt="二维码预览"
                      className="max-h-[360px] max-w-full object-contain"
                      width={size}
                      height={size}
                    />
                    {isTrial && trialLimits.addWatermark && (
                      <div className="absolute inset-x-0 bottom-2 text-center text-[10px] text-foreground/20">
                        试用版水印
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-10 w-10 opacity-30" />
                    <span className="text-sm">输入内容生成预览</span>
                  </div>
                )}
              </div>

              {/* 格式选择 + 下载 */}
              <div className="space-y-3">
                <div className="flex gap-2">
                  <button
                    onClick={() => setDownloadFormat('png')}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                      downloadFormat === 'png'
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/40 bg-background/30 text-muted-foreground hover:border-border/70 hover:text-foreground'
                    )}
                  >
                    PNG 格式
                  </button>
                  <button
                    onClick={() => setDownloadFormat('svg')}
                    className={cn(
                      'flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-all',
                      downloadFormat === 'svg'
                        ? 'border-primary/50 bg-primary/10 text-primary'
                        : 'border-border/40 bg-background/30 text-muted-foreground hover:border-border/70 hover:text-foreground'
                    )}
                  >
                    SVG 格式
                  </button>
                </div>

                <Button
                  onClick={handleDownload}
                  disabled={!previewUrl || isGenerating}
                  className="w-full gap-2"
                  size="lg"
                >
                  <Download className="h-4 w-4" />
                  下载二维码
                </Button>
              </div>

              {/* 参数摘要 */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-lg bg-background/40 p-2.5">
                  <div className="text-muted-foreground">样式</div>
                  <div className="font-medium text-foreground">
                    {STYLE_OPTIONS.find((s) => s.value === style)?.label}
                  </div>
                </div>
                <div className="rounded-lg bg-background/40 p-2.5">
                  <div className="text-muted-foreground">尺寸</div>
                  <div className="font-medium text-foreground">{size}px</div>
                </div>
                <div className="rounded-lg bg-background/40 p-2.5">
                  <div className="text-muted-foreground">容错</div>
                  <div className="font-medium text-foreground">{errorLevel}</div>
                </div>
                <div className="rounded-lg bg-background/40 p-2.5">
                  <div className="text-muted-foreground">定位点</div>
                  <div className="font-medium text-foreground">
                    {FINDER_OPTIONS.find((f) => f.value === finderPattern)?.label}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
