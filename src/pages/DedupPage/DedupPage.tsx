import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Layers,
  Copy,
  Download,
  Check,
  Trash2,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  FileText,
  Hash,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { dedupText, type DedupOptions, type DedupResult } from '@/utils/text-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

/** 示例文本 */
const SAMPLE_TEXT = `苹果
香蕉
苹果
橙子
香蕉
葡萄
西瓜
苹果
橙子
芒果
香蕉
葡萄
草莓
西瓜
樱桃`;

export default function DedupPage() {
  const { isTrial, trialLimits } = useLicense();

  const [inputText, setInputText] = useState(SAMPLE_TEXT);
  const [keepFirst, setKeepFirst] = useState(true);
  const [ignoreTrim, setIgnoreTrim] = useState(true);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [ignoreEmpty, setIgnoreEmpty] = useState(true);
  const [copied, setCopied] = useState(false);

  /** 计算去重结果 */
  const result = useMemo<DedupResult>(() => {
    const options: DedupOptions = {
      keepFirst,
      ignoreTrim,
      ignoreCase,
      ignoreEmpty,
    };

    if (!inputText.trim()) {
      return {
        text: '',
        originalLines: 0,
        resultLines: 0,
        removedLines: 0,
        duplicates: [],
      };
    }

    // 试用版行数限制
    let textToProcess = inputText;
    if (isTrial) {
      const lines = inputText.split('\n');
      if (lines.length > trialLimits.maxDedupLines) {
        textToProcess = lines.slice(0, trialLimits.maxDedupLines).join('\n');
      }
    }

    return dedupText(textToProcess, options);
  }, [inputText, keepFirst, ignoreTrim, ignoreCase, ignoreEmpty, isTrial, trialLimits.maxDedupLines]);

  /** 复制结果 */
  const handleCopy = useCallback(async () => {
    if (!result.text) {
      toast.warning('没有可复制的内容');
      return;
    }
    try {
      await navigator.clipboard.writeText(result.text);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, [result.text]);

  /** 导出TXT */
  const handleExport = useCallback(() => {
    if (!result.text) {
      toast.warning('没有可导出的内容');
      return;
    }
    const blob = new Blob([result.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `去重结果_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('去重结果已导出');
  }, [result.text]);

  /** 清空 */
  const handleClear = useCallback(() => {
    setInputText('');
  }, []);

  /** 加载示例 */
  const handleLoadSample = useCallback(() => {
    setInputText(SAMPLE_TEXT);
    toast.success('已加载示例文本');
  }, []);

  /** 统计数据 */
  const inputLineCount = inputText ? inputText.split('\n').length : 0;
  const reductionRate = result.originalLines > 0
    ? ((result.removedLines / result.originalLines) * 100).toFixed(1)
    : '0';

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
            <h1 className="text-2xl font-bold text-foreground">文本去重</h1>
            <p className="text-sm text-muted-foreground">
              自动去除重复行，支持多种去重选项
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleLoadSample} className="gap-2">
            <Sparkles className="h-4 w-4" />
            示例
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="gap-2">
            <Trash2 className="h-4 w-4" />
            清空
          </Button>
          <Button
            onClick={handleExport}
            size="sm"
            className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
          >
            <Download className="h-4 w-4" />
            导出TXT
          </Button>
        </div>
      </motion.div>

      {/* 选项卡 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* 保留策略 */}
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground">保留策略：</span>
                <Tabs
                  value={keepFirst ? 'first' : 'last'}
                  onValueChange={(v) => setKeepFirst(v === 'first')}
                >
                  <TabsList className="bg-muted/50">
                    <TabsTrigger value="first" className="gap-2 text-xs">
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      保留首次出现
                    </TabsTrigger>
                    <TabsTrigger value="last" className="gap-2 text-xs">
                      <ArrowUpDown className="h-3.5 w-3.5 rotate-180" />
                      保留末次出现
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 去重选项 */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ignore-trim"
                    checked={ignoreTrim}
                    onCheckedChange={setIgnoreTrim}
                  />
                  <Label htmlFor="ignore-trim" className="text-sm cursor-pointer">
                    忽略前后空格
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="ignore-case"
                    checked={ignoreCase}
                    onCheckedChange={setIgnoreCase}
                  />
                  <Label htmlFor="ignore-case" className="text-sm cursor-pointer">
                    忽略大小写
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="ignore-empty"
                    checked={ignoreEmpty}
                    onCheckedChange={setIgnoreEmpty}
                  />
                  <Label htmlFor="ignore-empty" className="text-sm cursor-pointer">
                    忽略空行
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 统计卡片 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-info/10">
                <FileText className="h-5 w-5 text-info" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">原始行数</div>
                <div className="text-xl font-bold text-foreground tabular-nums">
                  {result.originalLines}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-success/10">
                <Hash className="h-5 w-5 text-success" style={{ color: 'hsl(130 54% 42%)' }} />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">去重后</div>
                <div className="text-xl font-bold tabular-nums" style={{ color: 'hsl(130 54% 42%)' }}>
                  {result.resultLines}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-destructive/10">
                <Trash2 className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">移除重复</div>
                <div className="text-xl font-bold text-destructive tabular-nums">
                  {result.removedLines}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-white/20 bg-gradient-to-br from-primary/10 via-white/60 to-purple-500/10 backdrop-blur-xl dark:from-primary/20 dark:via-slate-900/50 dark:to-purple-500/20 dark:border-white/10">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/20">
                <RefreshCw className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="text-xs text-muted-foreground">精简率</div>
                <div className="text-xl font-bold text-primary tabular-nums">
                  {reductionRate}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 输入区 + 结果区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左侧：输入 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <Card className="h-full flex flex-col border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">原始文本</CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  {inputLineCount} 行
                </Badge>
              </div>
              {isTrial && (
                <Badge variant="secondary" className="text-xs">
                  试用版最多 {trialLimits.maxDedupLines} 行
                </Badge>
              )}
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="在此输入或粘贴文本，每行一条..."
                className="min-h-[400px] h-[400px] font-mono text-sm resize-none bg-background/50 border-border/50 focus:border-primary/50"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：结果 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="h-full flex flex-col border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">去重结果</CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  {result.resultLines} 行
                </Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="h-8 w-8"
                  title="复制"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" style={{ color: 'hsl(130 54% 42%)' }} />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleExport}
                  className="h-8 w-8"
                  title="下载"
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <div className="h-[400px] overflow-auto rounded-lg border border-border/30 bg-background/50 p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">
                {result.text || (
                  <span className="text-muted-foreground">去重结果将显示在这里...</span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 重复行详情 */}
      {result.duplicates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                重复行详情（Top 10）
              </CardTitle>
              <CardDescription className="text-xs">
                共发现 {result.duplicates.length} 种重复行
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {result.duplicates.slice(0, 12).map((dup, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 border border-border/30"
                  >
                    <span className="text-sm text-foreground truncate flex-1 mr-2" title={dup.line}>
                      {dup.line || <span className="text-muted-foreground italic">（空行）</span>}
                    </span>
                    <Badge variant="secondary" className="shrink-0 text-xs">
                      ×{dup.count}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 试用版提示 */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.35 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版限制</div>
            <div className="text-xs text-muted-foreground">
              文本去重最多 {trialLimits.maxDedupLines} 行，导出的 TXT 文件含试用水印。激活后解锁全部功能。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
