import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Trash2,
  Copy,
  Check,
  FileText,
  AlertTriangle,
  RefreshCw,
  Settings,
  Layers,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { Image } from '@/components/ui/image';

/** 容错等级 */
type EccLevel = 'L' | 'M' | 'Q' | 'H';

/** 生成结果项 */
interface QrResultItem {
  id: string;
  content: string;
  dataUrl: string;
  size: number;
  status?: 'success' | 'failed';
  error?: string;
}

/** 容错等级选项 */
const ECC_OPTIONS: { value: EccLevel; label: string; desc: string }[] = [
  { value: 'L', label: '低 (L)', desc: '7% 容错' },
  { value: 'M', label: '中 (M)', desc: '15% 容错' },
  { value: 'Q', label: '较高 (Q)', desc: '25% 容错' },
  { value: 'H', label: '高 (H)', desc: '30% 容错' },
];

/** 尺寸预设 */
const SIZE_PRESETS = [128, 256, 512, 1024];

/**
 * 二维码批量生成页面
 */
export default function QrBatchPage() {
  const { isTrial, trialLimits } = useLicense();

  // 输入内容（每行一个）
  const [textContent, setTextContent] = useState<string>(
    'https://www.example.com/product/1\nhttps://www.example.com/product/2\nhttps://www.example.com/product/3\nhttps://www.example.com/product/4\nhttps://www.example.com/product/5',
  );

  // 参数
  const [size, setSize] = useState<number>(256);
  const [eccLevel, setEccLevel] = useState<EccLevel>('M');
  const [format, setFormat] = useState<'png' | 'svg'>('png');

  // 生成结果
  const [results, setResults] = useState<QrResultItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** 解析行内容 */
  const lines = useMemo(() => {
    return textContent
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);
  }, [textContent]);

  /** 有效行数（受试用版限制） */
  const effectiveLines = useMemo(() => {
    if (isTrial && lines.length > trialLimits.qrMaxBatch) {
      return lines.slice(0, trialLimits.qrMaxBatch);
    }
    return lines;
  }, [lines, isTrial, trialLimits.qrMaxBatch]);

  /** 批量生成二维码 */
  const handleGenerate = useCallback(async () => {
    if (effectiveLines.length === 0) {
      toast.error('请输入至少一行内容');
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setResults([]);

    const newResults: QrResultItem[] = [];

    for (let i = 0; i < effectiveLines.length; i++) {
      const content = effectiveLines[i];
      try {
        const dataUrl = await QRCode.toDataURL(content, {
          width: size,
          margin: 2,
          errorCorrectionLevel: eccLevel as any,
        });
        newResults.push({
          id: `qr-${i}-${Date.now()}`,
          content,
          dataUrl,
          size,
          status: 'success',
        });
      } catch {
        newResults.push({
          id: `qr-${i}-${Date.now()}`,
          content,
          dataUrl: '',
          size,
          status: 'failed',
          error: '生成失败',
        });
      }
      setProgress(Math.round(((i + 1) / effectiveLines.length) * 100));
      await new Promise((r) => setTimeout(r, 10));
    }

    setResults(newResults);
    setIsGenerating(false);
    const successCount = newResults.filter((r) => r.status === 'success').length;
    toast.success(`成功生成 ${successCount} 个二维码`);
  }, [effectiveLines, size, eccLevel]);

  /** 下载单个二维码 */
  const handleDownloadSingle = useCallback((item: QrResultItem) => {
    const link = document.createElement('a');
    link.download = `二维码_${item.content.slice(0, 20).replace(/[\\/:*?"<>|]/g, '_')}.png`;
    link.href = item.dataUrl;
    link.click();
  }, []);

  /** 批量下载（打包为 zip 或逐个下载） */
  const handleDownloadAll = useCallback(() => {
    if (results.length === 0) return;

    // 逐个下载（简化实现，真实场景可用 JSZip 打包）
    results.forEach((item, index) => {
      setTimeout(() => {
        const link = document.createElement('a');
        link.download = `二维码_${index + 1}_${item.content.slice(0, 15).replace(/[\\/:*?"<>|]/g, '_')}.png`;
        link.href = item.dataUrl;
        link.click();
      }, index * 200);
    });

    toast.success(`已开始下载 ${results.length} 个二维码`);
  }, [results]);

  /** 复制内容 */
  const handleCopyContent = useCallback(async (content: string, id: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(id);
      toast.success('已复制内容');
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      toast.error('复制失败');
    }
  }, []);

  /** 清空结果 */
  const handleClear = useCallback(() => {
    setResults([]);
    setProgress(0);
  }, []);

  /** 清空输入 */
  const handleClearInput = useCallback(() => {
    setTextContent('');
    textareaRef.current?.focus();
  }, []);

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
              <Layers className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">批量生成</h1>
            <p className="text-sm text-muted-foreground">
              一行一个内容，批量生成二维码，支持打包下载
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {results.length > 0 && (
            <>
              <Button variant="outline" size="sm" onClick={handleClear} className="gap-2">
                <Trash2 className="h-4 w-4" />
                清空结果
              </Button>
              <Button
                onClick={handleDownloadAll}
                size="sm"
                className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
              >
                <Download className="h-4 w-4" />
                全部下载
              </Button>
            </>
          )}
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 最多 {trialLimits.qrMaxBatch} 个
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：输入 + 参数 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* 内容输入 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                批量内容
              </CardTitle>
              <CardDescription className="text-xs">
                每行一个内容（网址、文本等），自动批量生成
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Textarea
                  ref={textareaRef}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="每行输入一个内容，例如：&#10;https://www.example.com/1&#10;https://www.example.com/2&#10;https://www.example.com/3"
                  className="min-h-[200px] font-mono text-sm resize-none bg-background/50 border-border/50 focus:border-primary/50"
                />
                {textContent && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="!absolute right-2 top-2 z-20 h-7 w-7"
                    onClick={handleClearInput}
                    aria-label="清空"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>共 {lines.length} 行内容</span>
                {isTrial && lines.length > trialLimits.qrMaxBatch && (
                  <span className="text-amber-500 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    试用版仅生成前 {trialLimits.qrMaxBatch} 个
                  </span>
                )}
              </div>

              {/* 生成按钮 */}
              <Button
                onClick={handleGenerate}
                disabled={isGenerating || effectiveLines.length === 0}
                className="w-full h-11 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20 gap-2"
              >
                {isGenerating ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    生成中 {progress}%
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    批量生成二维码
                  </>
                )}
              </Button>

              {/* 进度条 */}
              {isGenerating && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                >
                  <Progress value={progress} className="h-1.5" />
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* 参数设置 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Settings className="h-5 w-5 text-primary" />
                参数设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 尺寸 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">二维码尺寸</Label>
                  <span className="text-sm font-medium text-primary tabular-nums">
                    {size} × {size} px
                  </span>
                </div>
                <Slider
                  value={[size]}
                  onValueChange={(v) => setSize(v[0])}
                  min={128}
                  max={1024}
                  step={64}
                  className="py-1"
                />
                <div className="flex gap-2">
                  {SIZE_PRESETS.map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={cn(
                        'flex-1 px-2 py-1.5 text-xs rounded-md transition-all',
                        size === s
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>

              {/* 容错等级 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">容错等级</Label>
                <Select value={eccLevel} onValueChange={(v) => setEccLevel(v as EccLevel)}>
                  <SelectTrigger className="bg-background/50 border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ECC_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center justify-between w-full gap-4">
                          <span>{opt.label}</span>
                          <span className="text-xs text-muted-foreground">{opt.desc}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 输出格式 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">输出格式</Label>
                <Tabs value={format} onValueChange={(v) => setFormat(v as 'png' | 'svg')}>
                  <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                    <TabsTrigger value="png" className="text-sm">
                      PNG
                    </TabsTrigger>
                    <TabsTrigger value="svg" className="text-sm">
                      SVG
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：结果展示 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-3"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10 h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <QrCode className="h-5 w-5 text-primary" />
                生成结果
                {results.length > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs font-normal">
                    共 {results.length} 个
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {results.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="relative mb-4">
                    <div className="absolute inset-0 rounded-2xl bg-primary/20 blur-xl" />
                    <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-purple-500/10 border border-primary/20">
                      <Layers className="h-10 w-10 text-primary/50" />
                    </div>
                  </div>
                  <p className="text-foreground font-medium mb-1">暂无生成结果</p>
                  <p className="text-sm text-muted-foreground max-w-xs">
                    在左侧输入内容，点击「批量生成二维码」按钮即可生成
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto pr-1">
                  <AnimatePresence>
                    {results.map((item, index) => (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.3, delay: index * 0.03 }}
                      >
                        <div className="group relative rounded-xl border border-border/40 bg-card/50 p-3 hover:border-primary/30 hover:shadow-md transition-all">
                          {/* 二维码图片 */}
                          <div className="aspect-square rounded-lg bg-white p-2 mb-2 flex items-center justify-center">
                            <Image
                              src={item.dataUrl}
                              alt={item.content}
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>

                          {/* 内容 */}
                          <div className="text-xs text-muted-foreground truncate mb-2" title={item.content}>
                            {item.content}
                          </div>

                          {/* 操作按钮 */}
                          <div className="flex gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="flex-1 h-7 text-xs gap-1"
                              onClick={() => handleCopyContent(item.content, item.id)}
                            >
                              {copiedId === item.id ? (
                                <Check className="h-3 w-3 text-success" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                              复制
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 h-7 text-xs gap-1"
                              onClick={() => handleDownloadSingle(item)}
                            >
                              <Download className="h-3 w-3" />
                              下载
                            </Button>
                          </div>

                          {/* 序号标签 */}
                          <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-primary/90 text-primary-foreground text-[10px] font-medium flex items-center justify-center">
                            {index + 1}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
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
            <div className="text-sm font-medium text-foreground">试用版限制</div>
            <div className="text-xs text-muted-foreground">
              试用版批量生成最多 {trialLimits.qrMaxBatch} 个二维码。激活后解锁无限制批量生成。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
