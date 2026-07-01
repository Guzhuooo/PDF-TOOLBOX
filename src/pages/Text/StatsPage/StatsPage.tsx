import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Type,
  FileText,
  Hash,
  AlignLeft,
  Clock,
  Languages,
  TrendingUp,
  Copy,
  Check,
  Upload,
  X,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface TextStats {
  totalChars: number;
  charsNoSpaces: number;
  chineseChars: number;
  englishChars: number;
  numberChars: number;
  punctuationChars: number;
  otherChars: number;
  chineseWords: number;
  englishWords: number;
  totalWords: number;
  lines: number;
  nonEmptyLines: number;
  paragraphs: number;
  sentences: number;
  readingTimeMinutes: number;
  wordFrequency: { word: string; count: number }[];
}

/** 计算文本统计信息 */
function calculateStats(text: string): TextStats {
  const totalChars = text.length;
  const charsNoSpaces = text.replace(/\s/g, '').length;

  // 字符分类
  let chineseChars = 0;
  let englishChars = 0;
  let numberChars = 0;
  let punctuationChars = 0;
  let otherChars = 0;

  const chineseRegex = /[\u4e00-\u9fa5]/;
  const englishRegex = /[a-zA-Z]/;
  const numberRegex = /[0-9]/;
  const punctuationRegex = /[，。！？、；：""''（）【】《》…—·,.!?;:"'()\[\]{}<>\-_/\\|@#$%^&*+=`~]/;

  for (const char of text) {
    if (chineseRegex.test(char)) {
      chineseChars++;
    } else if (englishRegex.test(char)) {
      englishChars++;
    } else if (numberRegex.test(char)) {
      numberChars++;
    } else if (punctuationRegex.test(char)) {
      punctuationChars++;
    } else if (char.trim() !== '') {
      otherChars++;
    }
  }

  // 行数
  const lines = text.length === 0 ? 0 : text.split('\n').length;
  const nonEmptyLines = text.length === 0 ? 0 : text.split('\n').filter((l) => l.trim().length > 0).length;

  // 段落数（连续非空行算一段）
  const paragraphs = text.length === 0 ? 0 : text.split(/\n\s*\n/).filter((p) => p.trim().length > 0).length;

  // 句子数
  const sentences = text.length === 0 ? 0 : (text.match(/[。！？.!?]+/g)?.length ?? 0) + (text.trim().length > 0 && !/[。！？.!?]$/.test(text.trim()) ? 1 : 0);

  // 中文词数（粗略：中文字符数的 0.6 倍）
  const chineseWords = Math.round(chineseChars * 0.6);
  // 英文词数
  const englishWords = text.match(/[a-zA-Z]+/g)?.length ?? 0;
  const totalWords = chineseWords + englishWords;

  // 阅读时长（中文：约 400 字/分钟，英文：约 200 词/分钟）
  const readingTimeMinutes = Math.max(0, chineseChars / 400 + englishWords / 200);

  // 词频统计
  const wordFreq = new Map<string, number>();

  // 中文词频（简单：双字词）
  for (let i = 0; i < text.length - 1; i++) {
    if (chineseRegex.test(text[i]) && chineseRegex.test(text[i + 1])) {
      const word = text.slice(i, i + 2);
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  // 英文词频
  const englishWordList = text.toLowerCase().match(/[a-zA-Z]{2,}/g) ?? [];
  for (const word of englishWordList) {
    wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
  }

  // 排序取 Top 20
  const wordFrequency = Array.from(wordFreq.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word, count]) => ({ word, count }));

  return {
    totalChars,
    charsNoSpaces,
    chineseChars,
    englishChars,
    numberChars,
    punctuationChars,
    otherChars,
    chineseWords,
    englishWords,
    totalWords,
    lines,
    nonEmptyLines,
    paragraphs,
    sentences,
    readingTimeMinutes,
    wordFrequency,
  };
}

/** 格式化时长 */
function formatReadingTime(minutes: number): string {
  if (minutes < 0.1) return '不到 1 秒';
  if (minutes < 1) return `${Math.round(minutes * 60)} 秒`;
  if (minutes < 60) return `${minutes.toFixed(1)} 分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  return `${hours} 小时 ${mins} 分钟`;
}

export default function TextStatsPage() {
  const { isTrial, trialLimits } = useLicense();
  const [text, setText] = useState('');
  const [copied, setCopied] = useState(false);

  /** 统计结果 */
  const stats = useMemo<TextStats>(() => calculateStats(text), [text]);

  /** 是否超出试用限制 */
  const isOverLimit = isTrial && stats.totalChars > trialLimits.textMaxChars;

  /** 处理文件上传 */
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error('文件过大，最大支持 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target?.result as string;
      if (isTrial && content.length > trialLimits.textMaxChars) {
        setText(content.slice(0, trialLimits.textMaxChars));
        toast.warning(`试用版最多处理 ${trialLimits.textMaxChars} 字，已自动截取`);
      } else {
        setText(content);
        toast.success(`已加载文件：${file.name}`);
      }
    };
    reader.onerror = () => {
      toast.error('文件读取失败');
    };
    reader.readAsText(file, 'UTF-8');
    e.target.value = '';
  }, [isTrial, trialLimits.textMaxChars]);

  /** 清空文本 */
  const handleClear = useCallback(() => {
    setText('');
  }, []);

  /** 复制统计结果 */
  const handleCopyStats = useCallback(async () => {
    const lines = [
      '=== 文本统计结果 ===',
      `总字符数：${stats.totalChars}`,
      `字符数（不含空格）：${stats.charsNoSpaces}`,
      `中文字符：${stats.chineseChars}`,
      `英文字符：${stats.englishChars}`,
      `数字字符：${stats.numberChars}`,
      `标点符号：${stats.punctuationChars}`,
      `总词数：${stats.totalWords}`,
      `中文词数：${stats.chineseWords}`,
      `英文词数：${stats.englishWords}`,
      `行数：${stats.lines}`,
      `非空行数：${stats.nonEmptyLines}`,
      `段落数：${stats.paragraphs}`,
      `句子数：${stats.sentences}`,
      `预估阅读时长：${formatReadingTime(stats.readingTimeMinutes)}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      toast.success('统计结果已复制');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败');
    }
  }, [stats]);

  /** 统计卡片数据 */
  const statCards = [
    { label: '总字符数', value: stats.totalChars.toLocaleString(), icon: Hash, color: 'text-primary', bg: 'bg-primary/10' },
    { label: '字符(不含空格)', value: stats.charsNoSpaces.toLocaleString(), icon: Type, color: 'text-info', bg: 'bg-info/10' },
    { label: '总词数', value: stats.totalWords.toLocaleString(), icon: FileText, color: 'text-success', bg: 'bg-success/10' },
    { label: '行数', value: stats.lines.toLocaleString(), icon: AlignLeft, color: 'text-warning', bg: 'bg-warning/10' },
    { label: '段落数', value: stats.paragraphs.toLocaleString(), icon: BarChart3, color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: '句子数', value: stats.sentences.toLocaleString(), icon: TrendingUp, color: 'text-cyan-500', bg: 'bg-cyan-500/10' },
  ];

  /** 字符类型占比 */
  const charTypeData = [
    { label: '中文', value: stats.chineseChars, color: 'bg-primary' },
    { label: '英文', value: stats.englishChars, color: 'bg-info' },
    { label: '数字', value: stats.numberChars, color: 'bg-success' },
    { label: '标点', value: stats.punctuationChars, color: 'bg-warning' },
    { label: '其他', value: stats.otherChars, color: 'bg-muted-foreground' },
  ];

  const totalCharTypes = charTypeData.reduce((sum, item) => sum + item.value, 0);

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
              <BarChart3 className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">文本统计</h1>
            <p className="text-sm text-muted-foreground">
              字符数、字数、行数、段落、词频等全方位统计分析
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopyStats} disabled={!text} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            复制结果
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear} disabled={!text} className="gap-2">
            <X className="h-4 w-4" />
            清空
          </Button>
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 限 {trialLimits.textMaxChars} 字
            </Badge>
          )}
        </div>
      </motion.div>

      {/* 主内容区 */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：输入区 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-3 space-y-4"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <Type className="h-5 w-5 text-primary" />
                  输入文本
                </CardTitle>
                <div className="flex items-center gap-2">
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept=".txt,.md,.csv,.json,.html,.css,.js,.ts,.py,.java,.cpp,.c,.h,.xml,.yml,.yaml"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <Button variant="outline" size="sm" className="gap-2" asChild>
                      <span>
                        <Upload className="h-4 w-4" />
                        上传文件
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
              <CardDescription className="text-xs">
                支持 TXT、Markdown、代码文件等纯文本格式，最大 10MB
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={text}
                onChange={(e) => {
                  const val = e.target.value;
                  if (isTrial && val.length > trialLimits.textMaxChars) {
                    setText(val.slice(0, trialLimits.textMaxChars));
                  } else {
                    setText(val);
                  }
                }}
                placeholder="在此粘贴或输入要统计的文本内容..."
                className="min-h-[400px] resize-y bg-background/50 border-border/50 focus:border-primary/50 font-mono text-sm leading-relaxed"
              />
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  当前：{stats.totalChars.toLocaleString()} 字符
                  {isTrial && (
                    <span className={cn('ml-2', isOverLimit ? 'text-destructive' : '')}>
                      / {trialLimits.textMaxChars} 限制
                    </span>
                  )}
                </span>
                {isOverLimit && (
                  <span className="text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    已超出限制
                  </span>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：统计结果 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* 核心指标卡片 */}
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.2 + i * 0.05 }}
                >
                  <Card className="h-full border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg shrink-0', card.bg)}>
                          <Icon className={cn('h-5 w-5', card.color)} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
                          <div className="text-lg font-bold text-foreground tabular-nums">
                            {card.value}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* 阅读时长 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 shrink-0">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">预估阅读时长</div>
                    <div className="text-xl font-bold text-foreground tabular-nums">
                      {formatReadingTime(stats.readingTimeMinutes)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 字符类型分布 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Languages className="h-4 w-4 text-primary" />
                  字符类型分布
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {totalCharTypes > 0 ? (
                  <>
                    <div className="h-3 rounded-full bg-muted overflow-hidden flex">
                      {charTypeData.map((item, i) => {
                        const pct = (item.value / totalCharTypes) * 100;
                        if (pct < 0.5) return null;
                        return (
                          <motion.div
                            key={item.label}
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: 0.5 + i * 0.1, ease: 'easeOut' }}
                            className={cn('h-full', item.color)}
                          />
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {charTypeData.map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                          <div className={cn('w-2.5 h-2.5 rounded-sm shrink-0', item.color)} />
                          <span className="text-muted-foreground">{item.label}</span>
                          <span className="ml-auto font-medium text-foreground tabular-nums">
                            {totalCharTypes > 0 ? ((item.value / totalCharTypes) * 100).toFixed(1) : 0}%
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">输入文本后显示分布</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* 词频 Top 20 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  高频词 Top 20
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {stats.wordFrequency.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {stats.wordFrequency.map((item, i) => {
                      const maxCount = stats.wordFrequency[0]?.count ?? 1;
                      const pct = (item.count / maxCount) * 100;
                      return (
                        <motion.div
                          key={item.word}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.55 + i * 0.03 }}
                          className="space-y-1"
                        >
                          <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-foreground flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-5 text-right tabular-nums">
                                {i + 1}.
                              </span>
                              {item.word}
                            </span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {item.count} 次
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: 0.6 + i * 0.03, ease: 'easeOut' }}
                              className="h-full bg-gradient-to-r from-primary to-purple-500 rounded-full"
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    输入更多文本后显示词频统计
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* 试用版提示 */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版</div>
            <div className="text-xs text-muted-foreground">
              试用版最多处理 {trialLimits.textMaxChars} 字符。激活后解锁全部功能，无字数限制。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
