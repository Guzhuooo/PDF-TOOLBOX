import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Upload,
  Download,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  FileText,
  QrCode,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { useLicense } from '@/contexts/LicenseContext';
import {
  generateQrCode,
  formatFileSize,
  type QrGenerateConfig,
  type QrBatchItem,
} from '@/utils/qr-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Image } from '@/components/ui/image';

/**
 * 批量生成二维码页面
 * 左侧参数设置 + 右侧输入与结果预览
 */
export default function BatchPage() {
  const { isTrial, trialLimits } = useLicense();

  // 输入内容（每行一个）
  const [textContent, setTextContent] = useState('');

  // 生成参数
  const [size, setSize] = useState(300);
  const [errorLevel, setErrorLevel] = useState<'L' | 'M' | 'Q' | 'H'>('M');
  const [foreground, setForeground] = useState('#1e1b4b');
  const [background, setBackground] = useState('#ffffff');
  const [margin, setMargin] = useState(2);

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [batchItems, setBatchItems] = useState<QrBatchItem[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // 解析输入行数
  const lineCount = useMemo(() => {
    if (!textContent.trim()) return 0;
    return textContent.split('\n').filter((l) => l.trim()).length;
  }, [textContent]);

  // 可生成数量（试用版限制）
  const maxItems = isTrial ? trialLimits.maxBatchGenerate : 1000;

  // 处理文本输入变化
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      const lines = value.split('\n').filter((l) => l.trim());
      if (isTrial && lines.length > maxItems) {
        toast.warning(`试用版最多批量生成 ${maxItems} 个二维码`);
        const limited = lines.slice(0, maxItems).join('\n');
        setTextContent(limited);
        return;
      }
      setTextContent(value);
    },
    [isTrial, maxItems]
  );

  // 处理文件上传（TXT/CSV）
  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const file = files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        const lines = content.split(/\r?\n/).filter((l) => l.trim());

        if (isTrial && lines.length > maxItems) {
          toast.warning(`试用版最多批量生成 ${maxItems} 个，已自动截取前 ${maxItems} 条`);
          setTextContent(lines.slice(0, maxItems).join('\n'));
        } else {
          setTextContent(lines.join('\n'));
        }
        toast.success(`已导入 ${Math.min(lines.length, maxItems)} 条内容`);
      };
      reader.onerror = () => {
        toast.error('文件读取失败');
      };
      reader.readAsText(file);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    },
    [isTrial, maxItems]
  );

  // 批量生成
  const handleGenerate = useCallback(async () => {
    const lines = textContent.split('\n').filter((l) => l.trim());
    if (lines.length === 0) {
      toast.error('请输入至少一条内容');
      return;
    }

    if (isTrial && lines.length > maxItems) {
      toast.error(`试用版最多批量生成 ${maxItems} 个二维码`);
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setBatchItems([]);

    const items: QrBatchItem[] = lines.map((line, index) => ({
      content: line.trim(),
      fileName: `qrcode_${index + 1}`,
    }));

    try {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const config: QrGenerateConfig = {
            content: item.content,
            size,
            errorLevel,
            foreground,
            background,
            margin,
            style: 'classic',
            useGradient: false,
            gradientStart: foreground,
            gradientEnd: foreground,
            gradientAngle: 0,
            finderPattern: 'square',
            finderColor: foreground,
            logoImage: null,
            logoRatio: 0.2,
            logoRadius: 8,
            logoBgColor: background,
            addWatermark: isTrial && trialLimits.addWatermark,
            watermarkText: '试用版',
          };

          const result = await generateQrCode(config);
          item.result = result;
        } catch (error) {
          logger.error(`Generate QR failed for item ${i}:`, String(error));
          item.error = '生成失败';
        }
        setProgress(Math.round(((i + 1) / items.length) * 100));
      }

      setBatchItems(items);
      const successCount = items.filter((i) => i.result).length;
      toast.success(`批量生成完成，成功 ${successCount} 个，失败 ${items.length - successCount} 个`);
    } catch (error) {
      toast.error('批量生成失败');
      logger.error('Batch generate failed:', String(error));
    } finally {
      setIsGenerating(false);
    }
  }, [textContent, size, errorLevel, foreground, background, margin, isTrial, maxItems, trialLimits]);

  // 下载单个
  const handleDownloadSingle = useCallback((item: QrBatchItem) => {
    if (!item.result) return;
    const link = document.createElement('a');
    link.download = `${item.fileName}.png`;
    link.href = item.result.dataUrl;
    link.click();
  }, []);

  // 批量下载（依次触发）
  const handleDownloadAll = useCallback(() => {
    const successItems = batchItems.filter((i) => i.result);
    if (successItems.length === 0) {
      toast.error('没有可下载的二维码');
      return;
    }

    successItems.forEach((item, index) => {
      setTimeout(() => {
        if (item.result) {
          const link = document.createElement('a');
          link.download = `${item.fileName}.png`;
          link.href = item.result.dataUrl;
          link.click();
        }
      }, index * 200);
    });

    toast.success(`已开始下载 ${successItems} 个二维码`);
  }, [batchItems]);

  // 复制所有内容
  const handleCopyAll = useCallback(() => {
    const successItems = batchItems.filter((i) => i.result);
    const text = successItems.map((i) => i.content).join('\n');
    if (!text) {
      toast.error('没有可复制的内容');
      return;
    }
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('已复制全部内容'))
      .catch(() => toast.error('复制失败'));
  }, [batchItems]);

  // 清空所有
  const handleClearAll = useCallback(() => {
    setTextContent('');
    setBatchItems([]);
    setProgress(0);
  }, []);

  const successCount = batchItems.filter((i) => i.result).length;
  const failCount = batchItems.filter((i) => i.error).length;

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              批量生成
            </h1>
            <p className="text-sm text-muted-foreground">
              输入多行内容，一键批量生成二维码
            </p>
          </div>
        </div>
      </div>

      {/* 试用版提示 */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-amber-600 dark:text-amber-400">
              试用版模式
            </p>
            <p className="mt-1 text-muted-foreground">
              试用版最多批量生成 {trialLimits.maxBatchGenerate} 个二维码，导出的二维码带轻微水印。
              激活后解锁全部功能，无数量限制，去除水印。
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：参数设置 */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg">生成参数</CardTitle>
              <CardDescription>统一设置所有二维码的样式参数</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 尺寸 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">尺寸</Label>
                  <span className="text-sm font-semibold text-primary">
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
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>100px</span>
                  <span>1000px</span>
                </div>
              </div>

              {/* 容错级别 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">容错级别</Label>
                <Select value={errorLevel} onValueChange={(v) => setErrorLevel(v as typeof errorLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="L">低 (L) - 7% 容错</SelectItem>
                    <SelectItem value="M">中 (M) - 15% 容错</SelectItem>
                    <SelectItem value="Q">较高 (Q) - 25% 容错</SelectItem>
                    <SelectItem value="H">高 (H) - 30% 容错</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 前景色 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">前景色</Label>
                <div className="flex gap-2">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                    <input
                      type="color"
                      value={foreground}
                      onChange={(e) => setForeground(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: foreground }}
                    />
                  </div>
                  <Input
                    value={foreground}
                    onChange={(e) => setForeground(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* 背景色 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">背景色</Label>
                <div className="flex gap-2">
                  <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-border">
                    <input
                      type="color"
                      value={background}
                      onChange={(e) => setBackground(e.target.value)}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                    />
                    <div
                      className="h-full w-full"
                      style={{ backgroundColor: background }}
                    />
                  </div>
                  <Input
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="font-mono text-sm"
                  />
                </div>
              </div>

              {/* 边距 */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">内边距</Label>
                  <span className="text-sm font-semibold text-primary">
                    {margin} 模块
                  </span>
                </div>
                <Slider
                  value={[margin]}
                  onValueChange={(v) => setMargin(v[0])}
                  min={0}
                  max={8}
                  step={1}
                  className="py-1"
                />
              </div>
            </CardContent>
          </Card>

          {/* 统计信息 */}
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-card/40">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {lineCount}
                  </div>
                  <div className="text-xs text-muted-foreground">待生成</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-500">
                    {successCount}
                  </div>
                  <div className="text-xs text-muted-foreground">已生成</div>
                </div>
              </div>
              {isTrial && (
                <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-center text-xs text-amber-600 dark:text-amber-400">
                  试用版上限：{maxItems} 个
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 右侧：输入区 + 结果区 */}
        <div className="space-y-6 lg:col-span-2">
          {/* 输入区 */}
          <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-card/40">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg">内容输入</CardTitle>
                  <CardDescription>每行一条内容，支持文本、网址等</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="gap-1.5"
                  >
                    <Upload className="h-4 w-4" />
                    导入文件
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.csv"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={textContent}
                onChange={handleTextChange}
                placeholder={'每行输入一条内容，例如：\nhttps://example.com/1\nhttps://example.com/2\n产品介绍文本...'}
                className="min-h-[200px] resize-y font-mono text-sm"
              />
              <div className="flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  共 {lineCount} 条内容
                  {isTrial && ` / 最多 ${maxItems} 条`}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearAll}
                    disabled={isGenerating || !textContent && batchItems.length === 0}
                    className="gap-1.5"
                  >
                    <Trash2 className="h-4 w-4" />
                    清空
                  </Button>
                  <Button
                    onClick={handleGenerate}
                    disabled={isGenerating || lineCount === 0}
                    className="gap-2"
                  >
                    {isGenerating ? (
                      <>
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        生成中 {progress}%
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4" />
                        批量生成
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* 进度条 */}
              {isGenerating && (
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.2 }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* 结果区 */}
          <AnimatePresence>
            {batchItems.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-card/40">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <QrCode className="h-5 w-5 text-primary" />
                          生成结果
                        </CardTitle>
                        <CardDescription>
                          成功 {successCount} 个
                          {failCount > 0 && `，失败 ${failCount} 个`}
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleCopyAll}
                          className="gap-1.5"
                        >
                          <Copy className="h-4 w-4" />
                          复制内容
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleDownloadAll}
                          disabled={successCount === 0}
                          className="gap-1.5"
                        >
                          <Download className="h-4 w-4" />
                          全部下载
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
                      {batchItems.map((item, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className="group relative overflow-hidden rounded-xl border border-border/50 bg-card/60 p-3 backdrop-blur-sm transition-all hover:shadow-md"
                        >
                          {item.result ? (
                            <>
                              <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-muted/30">
                                <Image
                                  src={item.result.dataUrl}
                                  alt={item.content}
                                  className="h-full w-full object-contain"
                                />
                              </div>
                              <div className="mt-2 space-y-1">
                                <p className="truncate text-xs font-medium text-foreground">
                                  {item.fileName}.png
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {item.content}
                                </p>
                              </div>
                              <Button
                                size="sm"
                                variant="secondary"
                                className="mt-2 w-full gap-1.5 text-xs"
                                onClick={() => handleDownloadSingle(item)}
                              >
                                <Download className="h-3.5 w-3.5" />
                                下载
                              </Button>
                            </>
                          ) : (
                            <div className="flex aspect-square w-full flex-col items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                              <AlertTriangle className="h-8 w-8" />
                              <p className="mt-2 text-xs">{item.error || '生成失败'}</p>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 空状态 */}
          {batchItems.length === 0 && !isGenerating && (
            <Card className="border-dashed border-white/20 bg-white/20 backdrop-blur-xl dark:border-white/10 dark:bg-card/20">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Layers className="h-8 w-8" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-foreground">
                  批量生成二维码
                </h3>
                <p className="mt-2 max-w-md text-center text-sm text-muted-foreground">
                  在左侧输入框中每行输入一条内容，点击"批量生成"即可一次性生成多个二维码。
                  支持导入 TXT/CSV 文件。
                </p>
                <div className="mt-4 flex gap-2">
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    支持 TXT
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <FileText className="h-3 w-3" />
                    支持 CSV
                  </Badge>
                  <Badge variant="outline" className="gap-1">
                    <Check className="h-3 w-3" />
                    批量下载
                  </Badge>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
