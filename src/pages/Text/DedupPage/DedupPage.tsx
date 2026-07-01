import { useState, useCallback, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  FileText,
  Copy,
  Check,
  Download,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Hash,
  Filter,
  ArrowRightLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function TextDedupPage() {
  const { isTrial, trialLimits } = useLicense();

  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [keepMode, setKeepMode] = useState<'first' | 'last'>('first');
  const [ignoreSpaces, setIgnoreSpaces] = useState<boolean>(false);
  const [ignoreCase, setIgnoreCase] = useState<boolean>(false);
  const [ignoreEmptyLines, setIgnoreEmptyLines] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [hasProcessed, setHasProcessed] = useState<boolean>(false);
  const [isTruncated, setIsTruncated] = useState<boolean>(false);

  /** 统计信息 */
  const stats = useMemo(() => {
    const inputLines = inputText ? inputText.split('\n').length : 0;
    const outputLines = outputText ? outputText.split('\n').filter(l => l !== '').length : 0;
    const removed = inputLines - outputLines;
    return { inputLines, outputLines, removed: Math.max(0, removed) };
  }, [inputText, outputText]);

  /** 去重核心逻辑 */
  const processDedup = useCallback((text: string): string => {
    if (!text) return '';

    let lines = text.split('\n');

    // 试用版截断
    if (isTrial) {
      const charCount = text.length;
      if (charCount > trialLimits.textMaxChars) {
        // 找到不超过限制的最后一个换行位置
        let truncated = text.slice(0, trialLimits.textMaxChars);
        const lastNewline = truncated.lastIndexOf('\n');
        if (lastNewline > 0) {
          truncated = truncated.slice(0, lastNewline);
        }
        lines = truncated.split('\n');
        setIsTruncated(true);
      } else {
        setIsTruncated(false);
      }
    } else {
      setIsTruncated(false);
    }

    const seen = new Map<string, string>(); // key -> 原始行
    const order: string[] = []; // 保留顺序

    for (let i = 0; i < lines.length; i++) {
      const originalLine = lines[i];
      let key = originalLine;

      // 忽略空行
      if (ignoreEmptyLines && originalLine.trim() === '') {
        continue;
      }

      // 忽略空格
      if (ignoreSpaces) {
        key = key.replace(/\s+/g, '');
      }

      // 忽略大小写
      if (ignoreCase) {
        key = key.toLowerCase();
      }

      if (keepMode === 'first') {
        if (!seen.has(key)) {
          seen.set(key, originalLine);
          order.push(key);
        }
      } else {
        // 末次出现：更新值，保持首次的 key 顺序
        if (!seen.has(key)) {
          order.push(key);
        }
        seen.set(key, originalLine);
      }
    }

    return order.map((k) => seen.get(k)).join('\n');
  }, [keepMode, ignoreSpaces, ignoreCase, ignoreEmptyLines, isTrial, trialLimits.textMaxChars]);

  /** 自动去重（输入变化时延迟触发） */
  useEffect(() => {
    if (!inputText) {
      setOutputText('');
      setHasProcessed(false);
      return;
    }

    const timer = setTimeout(() => {
      const result = processDedup(inputText);
      setOutputText(result);
      setHasProcessed(true);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputText, processDedup]);

  /** 手动去重 */
  const handleDedup = useCallback(() => {
    if (!inputText.trim()) {
      toast.warning('请先输入要去重的文本');
      return;
    }
    const result = processDedup(inputText);
    setOutputText(result);
    setHasProcessed(true);
    toast.success(`去重完成，移除 ${stats.removed} 行重复内容`);
  }, [inputText, processDedup, stats.removed]);

  /** 复制结果 */
  const handleCopy = useCallback(async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败');
    }
  }, [outputText]);

  /** 导出TXT */
  const handleExport = useCallback(() => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `文本去重结果_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('文件已导出');
  }, [outputText]);

  /** 清空 */
  const handleClear = useCallback(() => {
    setInputText('');
    setOutputText('');
    setHasProcessed(false);
    setIsTruncated(false);
  }, []);

  /** 加载示例文本 */
  const loadExample = useCallback(() => {
    const example = `苹果
香蕉
苹果
橙子
香蕉
葡萄
苹果
西瓜
橙子
草莓
葡萄
芒果
香蕉
菠萝
西瓜
芒果
樱桃
草莓
菠萝
樱桃`;
    setInputText(example);
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
              <Filter className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">文本去重</h1>
            <p className="text-sm text-muted-foreground">
              自动移除重复行，支持多种忽略选项
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadExample} className="gap-2">
            <FileText className="h-4 w-4" />
            加载示例
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} className="gap-2">
            <Trash2 className="h-4 w-4" />
            清空
          </Button>
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · {trialLimits.textMaxChars.toLocaleString()} 字限制
            </Badge>
          )}
        </div>
      </motion.div>

      {/* 工具栏 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* 保留模式 */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">保留方式</span>
                <Tabs value={keepMode} onValueChange={(v) => setKeepMode(v as 'first' | 'last')} className="w-auto">
                  <TabsList className="bg-muted/50 h-9">
                    <TabsTrigger value="first" className="text-sm h-8 px-4">
                      保留首次
                    </TabsTrigger>
                    <TabsTrigger value="last" className="text-sm h-8 px-4">
                      保留末次
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 分隔线 */}
              <div className="hidden lg:block w-px h-8 bg-border/60" />

              {/* 忽略选项 */}
              <div className="flex items-center gap-4 flex-wrap">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">忽略选项</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="ignore-spaces"
                      checked={ignoreSpaces}
                      onCheckedChange={(v) => setIgnoreSpaces(v === true)}
                    />
                    <Label htmlFor="ignore-spaces" className="text-sm cursor-pointer">
                      忽略空格
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="ignore-case"
                      checked={ignoreCase}
                      onCheckedChange={(v) => setIgnoreCase(v === true)}
                    />
                    <Label htmlFor="ignore-case" className="text-sm cursor-pointer">
                      忽略大小写
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="ignore-empty"
                      checked={ignoreEmptyLines}
                      onCheckedChange={(v) => setIgnoreEmptyLines(v === true)}
                    />
                    <Label htmlFor="ignore-empty" className="text-sm cursor-pointer">
                      忽略空行
                    </Label>
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex items-center gap-2 lg:ml-auto">
                <Button
                  onClick={handleDedup}
                  className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  开始去重
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 主内容区：左右两栏 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 输入区 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
        >
          <Card className="h-full border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  原始文本
                </CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  {stats.inputLines} 行
                </Badge>
              </div>
              <CardDescription className="text-xs">
                粘贴或输入需要去重的文本，每行一条记录
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="请输入或粘贴要去重的文本内容...

例如：
苹果
香蕉
苹果
橙子
香蕉"
                className={cn(
                  'min-h-[400px] resize-none font-mono text-sm leading-relaxed',
                  'bg-background/50 border-border/50 focus:border-primary/50',
                  'transition-all duration-200'
                )}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{inputText.length.toLocaleString()} 字符</span>
                {isTrial && (
                  <span className={cn(isTruncated ? 'text-warning font-medium' : '')}>
                    {isTruncated ? '已超出试用限制，仅处理前 ' + trialLimits.textMaxChars.toLocaleString() + ' 字' : '试用版最多 ' + trialLimits.textMaxChars.toLocaleString() + ' 字'}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 结果区 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
        >
          <Card className="h-full border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Check className="h-5 w-5 text-success" />
                  去重结果
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs font-normal">
                    {stats.outputLines} 行
                  </Badge>
                  {hasProcessed && stats.removed > 0 && (
                    <Badge variant="secondary" className="text-xs font-normal bg-warning/10 text-warning border-warning/30">
                      移除 {stats.removed} 行
                    </Badge>
                  )}
                </div>
              </div>
              <CardDescription className="text-xs">
                去重后的文本内容，可复制或导出
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative">
                <Textarea
                  value={outputText}
                  readOnly
                  placeholder="去重结果将显示在这里..."
                  className={cn(
                    'min-h-[400px] resize-none font-mono text-sm leading-relaxed',
                    'bg-background/30 border-border/50',
                    'transition-all duration-200'
                  )}
                />
                {outputText && (
                  <div className="absolute top-2 right-2 flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopy}
                      className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background"
                      aria-label="复制"
                    >
                      {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleExport}
                      className="h-7 w-7 rounded-md bg-background/80 backdrop-blur-sm hover:bg-background"
                      aria-label="导出"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
              <div className="mt-2 flex items-center justify-end text-xs text-muted-foreground">
                <span>{outputText.length.toLocaleString()} 字符</span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 统计信息 */}
      {hasProcessed && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Hash className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">原始行数</span>
                  </div>
                  <div className="text-2xl font-bold text-foreground tabular-nums">
                    {stats.inputLines}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Check className="h-4 w-4 text-success" />
                    <span className="text-xs text-muted-foreground">去重后行数</span>
                  </div>
                  <div className="text-2xl font-bold text-success tabular-nums">
                    {stats.outputLines}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <Trash2 className="h-4 w-4 text-warning" />
                    <span className="text-xs text-muted-foreground">移除行数</span>
                  </div>
                  <div className="text-2xl font-bold text-warning tabular-nums">
                    {stats.removed}
                  </div>
                </div>
                <div className="text-center">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    <RefreshCw className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">去重率</span>
                  </div>
                  <div className="text-2xl font-bold text-primary tabular-nums">
                    {stats.inputLines > 0 ? ((stats.removed / stats.inputLines) * 100).toFixed(1) : '0.0'}%
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 试用版提示 */}
      {isTrial && isTruncated && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版字数限制</div>
            <div className="text-xs text-muted-foreground">
              您的文本已超过试用版 {trialLimits.textMaxChars.toLocaleString()} 字限制，仅处理了前 {trialLimits.textMaxChars.toLocaleString()} 字。激活后解锁无限制处理。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
