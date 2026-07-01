import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Sparkles,
  Download,
  Palette,
  Maximize2,
  Target,
  Type,
  Image as ImageIcon,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { getQrModules, type QrErrorLevel } from '@/utils/qr-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

/* ============================================================
 *  类型定义
 * ============================================================ */

/** 二维码点样式 */
type DotStyle = 'square' | 'rounded' | 'dots' | 'classy' | 'diamond';

/** 定位点样式 */
type FinderStyle = 'square' | 'rounded' | 'dots' | 'diamond';

/** 渐变方向 */
type GradientDirection = 'horizontal' | 'vertical' | 'diagonal' | 'radial';

/** 样式模板 */
interface StyleTemplate {
  id: string;
  name: string;
  dotStyle: DotStyle;
  finderStyle: FinderStyle;
  foreground: string;
  background: string;
  gradient: boolean;
  gradientStart: string;
  gradientEnd: string;
  finderOuter: string;
  finderInner: string;
}

/* ============================================================
 *  预设样式模板
 * ============================================================ */

const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 'classic',
    name: '经典黑白',
    dotStyle: 'square',
    finderStyle: 'square',
    foreground: '#000000',
    background: '#ffffff',
    gradient: false,
    gradientStart: '#000000',
    gradientEnd: '#000000',
    finderOuter: '#000000',
    finderInner: '#000000',
  },
  {
    id: 'rounded-blue',
    name: '圆角靛蓝',
    dotStyle: 'rounded',
    finderStyle: 'rounded',
    foreground: '#4F46E5',
    background: '#ffffff',
    gradient: true,
    gradientStart: '#6366F1',
    gradientEnd: '#8B5CF6',
    finderOuter: '#4F46E5',
    finderInner: '#8B5CF6',
  },
  {
    id: 'dots-purple',
    name: '圆点紫粉',
    dotStyle: 'dots',
    finderStyle: 'dots',
    foreground: '#9333EA',
    background: '#ffffff',
    gradient: true,
    gradientStart: '#A855F7',
    gradientEnd: '#EC4899',
    finderOuter: '#9333EA',
    finderInner: '#EC4899',
  },
  {
    id: 'classy-teal',
    name: '典雅青蓝',
    dotStyle: 'classy',
    finderStyle: 'rounded',
    foreground: '#0D9488',
    background: '#F0FDFA',
    gradient: true,
    gradientStart: '#0D9488',
    gradientEnd: '#0EA5E9',
    finderOuter: '#0D9488',
    finderInner: '#0EA5E9',
  },
  {
    id: 'diamond-gold',
    name: '菱形金箔',
    dotStyle: 'diamond',
    finderStyle: 'diamond',
    foreground: '#B45309',
    background: '#FFFBEB',
    gradient: true,
    gradientStart: '#F59E0B',
    gradientEnd: '#D97706',
    finderOuter: '#B45309',
    finderInner: '#F59E0B',
  },
  {
    id: 'dark-neon',
    name: '暗夜霓虹',
    dotStyle: 'rounded',
    finderStyle: 'rounded',
    foreground: '#22D3EE',
    background: '#0F172A',
    gradient: true,
    gradientStart: '#22D3EE',
    gradientEnd: '#A855F7',
    finderOuter: '#22D3EE',
    finderInner: '#A855F7',
  },
];

/* ============================================================
 *  页面组件
 * ============================================================ */

export default function QrBeautifyPage() {
  const { isTrial, trialLimits } = useLicense();
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 内容
  const [content, setContent] = useState('https://www.example.com');
  const [copied, setCopied] = useState(false);

  // 样式参数
  const [size, setSize] = useState(300);
  const [errorLevel, setErrorLevel] = useState<QrErrorLevel>('M');
  const [dotStyle, setDotStyle] = useState<DotStyle>('rounded');
  const [finderStyle, setFinderStyle] = useState<FinderStyle>('rounded');
  const [backgroundColor, setBackgroundColor] = useState('#ffffff');
  const [foregroundColor, setForegroundColor] = useState('#4F46E5');
  const [useGradient, setUseGradient] = useState(true);
  const [gradientStart, setGradientStart] = useState('#6366F1');
  const [gradientEnd, setGradientEnd] = useState('#8B5CF6');
  const [gradientDirection, setGradientDirection] = useState<GradientDirection>('diagonal');
  const [finderOuterColor, setFinderOuterColor] = useState('#4F46E5');
  const [finderInnerColor, setFinderInnerColor] = useState('#8B5CF6');
  const [quietZone, setQuietZone] = useState(4);

  // 当前选中模板
  const [activeTemplate, setActiveTemplate] = useState('rounded-blue');

  /* ============================================================
   *  应用模板
   * ============================================================ */
  const applyTemplate = useCallback((templateId: string) => {
    const tpl = STYLE_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    setActiveTemplate(templateId);
    setDotStyle(tpl.dotStyle);
    setFinderStyle(tpl.finderStyle);
    setBackgroundColor(tpl.background);
    setForegroundColor(tpl.foreground);
    setUseGradient(tpl.gradient);
    setGradientStart(tpl.gradientStart);
    setGradientEnd(tpl.gradientEnd);
    setFinderOuterColor(tpl.finderOuter);
    setFinderInnerColor(tpl.finderInner);
  }, []);

  /* ============================================================
   *  生成二维码矩阵
   * ============================================================ */
  const [qrMatrix, setQrMatrix] = useState<boolean[][] | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!content.trim()) {
      setQrMatrix(null);
      return;
    }
    getQrModules(content, errorLevel)
      .then((res) => {
        if (!cancelled) setQrMatrix(res.modules);
      })
      .catch(() => {
        if (!cancelled) setQrMatrix(null);
      });
    return () => {
      cancelled = true;
    };
  }, [content, errorLevel]);

  /* ============================================================
   *  Canvas 渲染美化二维码
   * ============================================================ */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !qrMatrix) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const matrixSize = qrMatrix.length;
    const totalModules = matrixSize + quietZone * 2;
    const moduleSize = size / totalModules;

    // 设置 canvas 尺寸（2x 高清）
    const dpr = window.devicePixelRatio || 2;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);

    // 创建前景渐变
    let fillStyle: string | CanvasGradient = foregroundColor;
    if (useGradient) {
      let gradient: CanvasGradient;
      switch (gradientDirection) {
        case 'horizontal':
          gradient = ctx.createLinearGradient(0, 0, size, 0);
          break;
        case 'vertical':
          gradient = ctx.createLinearGradient(0, 0, 0, size);
          break;
        case 'radial':
          gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
          break;
        case 'diagonal':
        default:
          gradient = ctx.createLinearGradient(0, 0, size, size);
          break;
      }
      gradient.addColorStop(0, gradientStart);
      gradient.addColorStop(1, gradientEnd);
      fillStyle = gradient;
    }

    // 偏移（静默区）
    const offset = quietZone * moduleSize;

    // 定位点位置（三个角）
    const finderPositions = [
      { row: 0, col: 0 },
      { row: 0, col: matrixSize - 7 },
      { row: matrixSize - 7, col: 0 },
    ];

    // 判断是否是定位点区域
    const isFinderArea = (row: number, col: number): boolean => {
      for (const pos of finderPositions) {
        if (row >= pos.row && row < pos.row + 7 && col >= pos.col && col < pos.col + 7) {
          return true;
        }
      }
      return false;
    };

    // 绘制数据点（非定位点区域）
    ctx.fillStyle = fillStyle;

    for (let row = 0; row < matrixSize; row++) {
      for (let col = 0; col < matrixSize; col++) {
        if (!qrMatrix[row][col]) continue;
        if (isFinderArea(row, col)) continue;

        const x = offset + col * moduleSize;
        const y = offset + row * moduleSize;

        switch (dotStyle) {
          case 'square':
            ctx.fillRect(x, y, moduleSize, moduleSize);
            break;
          case 'rounded': {
            const r = moduleSize * 0.3;
            ctx.beginPath();
            ctx.roundRect(x, y, moduleSize, moduleSize, r);
            ctx.fill();
            break;
          }
          case 'dots': {
            const cx = x + moduleSize / 2;
            const cy = y + moduleSize / 2;
            const r = moduleSize * 0.45;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            break;
          }
          case 'classy': {
            // 上下左右是否有相邻点，决定圆角位置
            const hasTop = row > 0 && qrMatrix[row - 1][col];
            const hasBottom = row < matrixSize - 1 && qrMatrix[row + 1][col];
            const hasLeft = col > 0 && qrMatrix[row][col - 1];
            const hasRight = col < matrixSize - 1 && qrMatrix[row][col + 1];

            const r = moduleSize * 0.4;
            const tl = hasTop || hasLeft ? 0 : r;
            const tr = hasTop || hasRight ? 0 : r;
            const bl = hasBottom || hasLeft ? 0 : r;
            const br = hasBottom || hasRight ? 0 : r;

            ctx.beginPath();
            ctx.roundRect(x, y, moduleSize, moduleSize, [tl, tr, br, bl]);
            ctx.fill();
            break;
          }
          case 'diamond': {
            const cx = x + moduleSize / 2;
            const cy = y + moduleSize / 2;
            const half = moduleSize * 0.5;
            ctx.beginPath();
            ctx.moveTo(cx, cy - half);
            ctx.lineTo(cx + half, cy);
            ctx.lineTo(cx, cy + half);
            ctx.lineTo(cx - half, cy);
            ctx.closePath();
            ctx.fill();
            break;
          }
        }
      }
    }

    // 绘制三个定位点
    for (const pos of finderPositions) {
      const fx = offset + pos.col * moduleSize;
      const fy = offset + pos.row * moduleSize;
      const fSize = 7 * moduleSize;

      // 外框
      ctx.fillStyle = finderOuterColor;
      drawFinderPattern(ctx, fx, fy, fSize, finderStyle, 'outer');

      // 内点
      ctx.fillStyle = finderInnerColor;
      const innerSize = 3 * moduleSize;
      const innerOffset = 2 * moduleSize;
      drawFinderPattern(ctx, fx + innerOffset, fy + innerOffset, innerSize, finderStyle, 'inner');
    }
  }, [
    qrMatrix,
    size,
    dotStyle,
    finderStyle,
    backgroundColor,
    foregroundColor,
    useGradient,
    gradientStart,
    gradientEnd,
    gradientDirection,
    finderOuterColor,
    finderInnerColor,
    quietZone,
  ]);

  /* ============================================================
   *  绘制定位点辅助函数
   * ============================================================ */
  function drawFinderPattern(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    size: number,
    style: FinderStyle,
    type: 'outer' | 'inner',
  ) {
    switch (style) {
      case 'square':
        if (type === 'outer') {
          // 外框：7x7 实心
          ctx.fillRect(x, y, size, size);
          // 挖空中间 3x3（通过背景色覆盖 5x5 区域）
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillRect(x + size / 7, y + size / 7, size - (size / 7) * 2, size - (size / 7) * 2);
          ctx.restore();
        } else {
          ctx.fillRect(x, y, size, size);
        }
        break;
      case 'rounded': {
        const r = size * 0.25;
        if (type === 'outer') {
          ctx.beginPath();
          ctx.roundRect(x, y, size, size, r);
          ctx.fill();
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          const innerR = r * 0.6;
          ctx.beginPath();
          ctx.roundRect(x + size / 7, y + size / 7, size - (size / 7) * 2, size - (size / 7) * 2, innerR);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.roundRect(x, y, size, size, r * 0.5);
          ctx.fill();
        }
        break;
      }
      case 'dots': {
        if (type === 'outer') {
          // 圆点外框：画一圈圆点
          const dotCount = 7;
          const dotSize = size / dotCount;
          for (let i = 0; i < dotCount; i++) {
            for (let j = 0; j < dotCount; j++) {
              const onBorder = i === 0 || i === dotCount - 1 || j === 0 || j === dotCount - 1;
              if (onBorder) {
                const cx = x + j * dotSize + dotSize / 2;
                const cy = y + i * dotSize + dotSize / 2;
                ctx.beginPath();
                ctx.arc(cx, cy, dotSize * 0.45, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        } else {
          const cx = x + size / 2;
          const cy = y + size / 2;
          ctx.beginPath();
          ctx.arc(cx, cy, size * 0.45, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'diamond': {
        const cx = x + size / 2;
        const cy = y + size / 2;
        const half = size / 2;
        if (type === 'outer') {
          ctx.beginPath();
          ctx.moveTo(cx, cy - half);
          ctx.lineTo(cx + half, cy);
          ctx.lineTo(cx, cy + half);
          ctx.lineTo(cx - half, cy);
          ctx.closePath();
          ctx.fill();
          ctx.save();
          ctx.globalCompositeOperation = 'destination-out';
          const innerHalf = half * 0.6;
          ctx.beginPath();
          ctx.moveTo(cx, cy - innerHalf);
          ctx.lineTo(cx + innerHalf, cy);
          ctx.lineTo(cx, cy + innerHalf);
          ctx.lineTo(cx - innerHalf, cy);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        } else {
          ctx.beginPath();
          ctx.moveTo(cx, cy - half);
          ctx.lineTo(cx + half, cy);
          ctx.lineTo(cx, cy + half);
          ctx.lineTo(cx - half, cy);
          ctx.closePath();
          ctx.fill();
        }
        break;
      }
    }
  }

  /* ============================================================
   *  下载 PNG
   * ============================================================ */
  const handleDownloadPng = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      const link = document.createElement('a');
      link.download = `美化二维码_${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      toast.success('二维码已下载');
    } catch {
      toast.error('下载失败');
    }
  }, []);

  /* ============================================================
   *  下载 SVG
   * ============================================================ */
  const handleDownloadSvg = useCallback(() => {
    if (!qrMatrix) return;
    try {
      const matrixSize = qrMatrix.length;
      const totalModules = matrixSize + quietZone * 2;
      const moduleSize = 10;
      const svgSize = totalModules * moduleSize;

      let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="${svgSize}" height="${svgSize}" viewBox="0 0 ${svgSize} ${svgSize}">`;
      svgContent += `<rect width="${svgSize}" height="${svgSize}" fill="${backgroundColor}"/>`;

      const offset = quietZone * moduleSize;
      const fgColor = useGradient ? gradientStart : foregroundColor;

      // 简化 SVG：用矩形表示数据点
      for (let row = 0; row < matrixSize; row++) {
        for (let col = 0; col < matrixSize; col++) {
          if (qrMatrix[row][col]) {
            const x = offset + col * moduleSize;
            const y = offset + row * moduleSize;
            if (dotStyle === 'dots') {
              const cx = x + moduleSize / 2;
              const cy = y + moduleSize / 2;
              svgContent += `<circle cx="${cx}" cy="${cy}" r="${moduleSize * 0.45}" fill="${fgColor}"/>`;
            } else {
              svgContent += `<rect x="${x}" y="${y}" width="${moduleSize}" height="${moduleSize}" fill="${fgColor}" rx="${dotStyle === 'rounded' ? moduleSize * 0.3 : 0}"/>`;
            }
          }
        }
      }

      svgContent += '</svg>';

      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `美化二维码_${Date.now()}.svg`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('SVG 已下载');
    } catch {
      toast.error('下载失败');
    }
  }, [qrMatrix, backgroundColor, useGradient, gradientStart, foregroundColor, dotStyle, quietZone]);

  /* ============================================================
   *  复制内容
   * ============================================================ */
  const handleCopyContent = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败');
    }
  }, [content]);

  /* ============================================================
   *  重置
   * ============================================================ */
  const handleReset = useCallback(() => {
    applyTemplate('rounded-blue');
    setSize(300);
    setErrorLevel('M');
    setQuietZone(4);
    toast.info('已重置为默认样式');
  }, [applyTemplate]);

  /* ============================================================
   *  渲染
   * ============================================================ */
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
              <Sparkles className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">二维码美化</h1>
            <p className="text-sm text-muted-foreground">
              多种样式模板、渐变色、定位点自定义，打造专属二维码
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重置
          </Button>
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版
            </Badge>
          )}
        </div>
      </motion.div>

      {/* 主体：预览 + 参数 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：预览区 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" />
                实时预览
              </CardTitle>
              <CardDescription className="text-xs">
                调整参数实时查看效果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 二维码预览 */}
              <div className="flex justify-center p-6 rounded-xl bg-gradient-to-br from-muted/50 to-background/50 border border-border/30">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-xl opacity-50" />
                  <canvas
                    ref={canvasRef}
                    className="relative rounded-lg shadow-md"
                    style={{ width: size, height: size, maxWidth: '100%' }}
                  />
                </div>
              </div>

              {/* 下载按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleDownloadPng}
                  disabled={!qrMatrix}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
                >
                  <Download className="h-4 w-4" />
                  下载 PNG
                </Button>
                <Button
                  variant="outline"
                  onClick={handleDownloadSvg}
                  disabled={!qrMatrix}
                  className="gap-2"
                >
                  <Download className="h-4 w-4" />
                  下载 SVG
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 内容输入卡片 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" />
                二维码内容
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="输入文本、网址、WiFi信息等..."
                  rows={3}
                  className="w-full resize-none rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  onClick={handleCopyContent}
                  className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  title="复制内容"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>字符数：{content.length}</span>
                {qrMatrix && <span>矩阵大小：{qrMatrix.length} × {qrMatrix.length}</span>}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：参数面板 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-3 space-y-4"
        >
          {/* 样式模板 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                样式模板
              </CardTitle>
              <CardDescription className="text-xs">
                点击快速应用预设样式
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {STYLE_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.id}
                    onClick={() => applyTemplate(tpl.id)}
                    className={cn(
                      'group relative flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all duration-200',
                      activeTemplate === tpl.id
                        ? 'border-primary bg-primary/10 shadow-md shadow-primary/10'
                        : 'border-border/40 bg-background/30 hover:border-primary/40 hover:bg-primary/5'
                    )}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: tpl.background }}
                    >
                      <div
                        className="w-6 h-6 rounded-sm"
                        style={{
                          background: tpl.gradient
                            ? `linear-gradient(135deg, ${tpl.gradientStart}, ${tpl.gradientEnd})`
                            : tpl.foreground,
                        }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground group-hover:text-foreground transition-colors">
                      {tpl.name}
                    </span>
                    {activeTemplate === tpl.id && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-[10px]">
                        ✓
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 点样式 + 定位点 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 点样式 */}
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Maximize2 className="h-4 w-4 text-primary" />
                  点样式
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tabs value={dotStyle} onValueChange={(v) => setDotStyle(v as DotStyle)}>
                  <TabsList className="w-full grid grid-cols-5 bg-muted/30 p-1 h-auto">
                    <TabsTrigger value="square" className="text-xs py-1.5">方形</TabsTrigger>
                    <TabsTrigger value="rounded" className="text-xs py-1.5">圆角</TabsTrigger>
                    <TabsTrigger value="dots" className="text-xs py-1.5">圆点</TabsTrigger>
                    <TabsTrigger value="classy" className="text-xs py-1.5">典雅</TabsTrigger>
                    <TabsTrigger value="diamond" className="text-xs py-1.5">菱形</TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardContent>
            </Card>

            {/* 定位点 */}
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  定位点
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Tabs value={finderStyle} onValueChange={(v) => setFinderStyle(v as FinderStyle)}>
                  <TabsList className="w-full grid grid-cols-4 bg-muted/30 p-1 h-auto">
                    <TabsTrigger value="square" className="text-xs py-1.5">方形</TabsTrigger>
                    <TabsTrigger value="rounded" className="text-xs py-1.5">圆角</TabsTrigger>
                    <TabsTrigger value="dots" className="text-xs py-1.5">圆点</TabsTrigger>
                    <TabsTrigger value="diamond" className="text-xs py-1.5">菱形</TabsTrigger>
                  </TabsList>
                </Tabs>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">外框色</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={finderOuterColor}
                        onChange={(e) => setFinderOuterColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border border-border/50 bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted-foreground">{finderOuterColor}</span>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">内点色</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={finderInnerColor}
                        onChange={(e) => setFinderInnerColor(e.target.value)}
                        className="h-8 w-8 cursor-pointer rounded border border-border/50 bg-transparent"
                      />
                      <span className="text-xs font-mono text-muted-foreground">{finderInnerColor}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 颜色设置 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4 text-primary" />
                颜色设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 背景色 */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-border/50 bg-transparent"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">背景色</div>
                    <div className="text-xs font-mono text-muted-foreground">{backgroundColor}</div>
                  </div>
                </div>
              </div>

              {/* 渐变开关 */}
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-foreground">渐变色前景</div>
                  <div className="text-xs text-muted-foreground">开启后使用渐变色填充二维码</div>
                </div>
                <Switch checked={useGradient} onCheckedChange={setUseGradient} />
              </div>

              {/* 前景色 / 渐变色 */}
              {useGradient ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">渐变起始色</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={gradientStart}
                          onChange={(e) => setGradientStart(e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded border border-border/50 bg-transparent"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{gradientStart}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">渐变结束色</Label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={gradientEnd}
                          onChange={(e) => setGradientEnd(e.target.value)}
                          className="h-8 w-8 cursor-pointer rounded border border-border/50 bg-transparent"
                        />
                        <span className="text-xs font-mono text-muted-foreground">{gradientEnd}</span>
                      </div>
                    </div>
                  </div>

                  {/* 渐变方向 */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">渐变方向</Label>
                    <Select value={gradientDirection} onValueChange={(v) => setGradientDirection(v as GradientDirection)}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="horizontal">水平方向</SelectItem>
                        <SelectItem value="vertical">垂直方向</SelectItem>
                        <SelectItem value="diagonal">对角线方向</SelectItem>
                        <SelectItem value="radial">径向渐变</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 渐变预览条 */}
                  <div
                    className="h-6 rounded-lg border border-border/30"
                    style={{
                      background:
                        gradientDirection === 'radial'
                          ? `radial-gradient(circle, ${gradientStart}, ${gradientEnd})`
                          : gradientDirection === 'horizontal'
                          ? `linear-gradient(to right, ${gradientStart}, ${gradientEnd})`
                          : gradientDirection === 'vertical'
                          ? `linear-gradient(to bottom, ${gradientStart}, ${gradientEnd})`
                          : `linear-gradient(135deg, ${gradientStart}, ${gradientEnd})`,
                    }}
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={foregroundColor}
                    onChange={(e) => setForegroundColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-border/50 bg-transparent"
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">前景色</div>
                    <div className="text-xs font-mono text-muted-foreground">{foregroundColor}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 尺寸与容错 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Maximize2 className="h-4 w-4 text-primary" />
                尺寸与容错
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 尺寸 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">二维码尺寸</Label>
                  <span className="text-sm font-medium tabular-nums text-primary">{size} px</span>
                </div>
                <Slider
                  value={[size]}
                  onValueChange={(v) => setSize(v[0])}
                  min={100}
                  max={800}
                  step={10}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>100px</span>
                  <span>800px</span>
                </div>
              </div>

              {/* 容错级别 */}
              <div className="space-y-2">
                <Label className="text-sm">容错级别</Label>
                <Select value={errorLevel} onValueChange={(v) => setErrorLevel(v as QrErrorLevel)}>
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">L - 低（7% 容错）</SelectItem>
                    <SelectItem value="M">M - 中（15% 容错）</SelectItem>
                    <SelectItem value="Q">Q - 较高（25% 容错）</SelectItem>
                    <SelectItem value="H">H - 高（30% 容错）</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  容错级别越高，二维码越容易被扫描，适合添加 Logo 或复杂美化
                </p>
              </div>

              {/* 静默区 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">边距（静默区）</Label>
                  <span className="text-sm font-medium tabular-nums text-primary">{quietZone} 模块</span>
                </div>
                <Slider
                  value={[quietZone]}
                  onValueChange={(v) => setQuietZone(v[0])}
                  min={0}
                  max={10}
                  step={1}
                  className="w-full"
                />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 试用版提示 */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版</div>
            <div className="text-xs text-muted-foreground">
              试用版二维码美化功能完整可用。激活后解锁全部 5 大工具模块，无任何限制。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
