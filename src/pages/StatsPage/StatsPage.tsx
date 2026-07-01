import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  FileText,
  Type,
  Hash,
  AlignLeft,
  Clock,
  Languages,
  TrendingUp,
  Copy,
  Download,
  Check,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { getTextStats, type TextStats } from '@/utils/text-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/** 示例文本 */
const SAMPLE_TEXT = `欢迎使用文本工具箱！

这是一款功能强大的文本处理工具，支持文本对比、文本去重和文本统计三大功能。

所有处理均在您的浏览器本地完成，数据不会上传到任何服务器，保护您的隐私安全。

Text Toolbox is a powerful text processing tool that supports text comparison, text deduplication and text statistics.

All processing is done locally in your browser, and data will not be uploaded to any server, protecting your privacy and security.

中文文本统计功能可以统计字符数、字数、行数、段落数，以及中英文占比和词频分析。
English text statistics can count characters, words, lines, paragraphs, as well as Chinese-English ratio and word frequency analysis.

快来试试吧！`;

export default function StatsPage() {
  const { isTrial, trialLimits } = useLicense();
  const [text, setText] = useState(SAMPLE_TEXT);
  const [copied, setCopied] = useState(false);

  /** 计算文本统计 */
  const stats = useMemo<TextStats>(() => {
    if (!text) {
      return {
        totalChars: 0,
        charsNoSpace: 0,
        chineseChars: 0,
        englishChars: 0,
        digitChars: 0,
        chineseRatio: 0,
        englishRatio: 0,
        wordCount: 0,
        lineCount: 0,
        nonEmptyLines: 0,
        paragraphCount: 0,
        sentenceCount: 0,
        readingMinutes: 0,
        wordFrequency: [],
      };
    }
    return getTextStats(text);
  }, [text]);

  /** 复制文本 */
  const handleCopy = useCallback(async () => {
    if (!text) {
      toast.warning('没有可复制的内容');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, [text]);

  /** 导出统计报告 */
  const handleExport = useCallback(() => {
    if (!text) {
      toast.warning('请先输入文本');
      return;
    }

    const lines = [
      '=== 文本统计报告 ===',
      '',
      '【基础统计】',
      `总字符数（含空格）：${stats.totalChars}`,
      `总字符数（不含空格）：${stats.charsNoSpace}`,
      `字数：${stats.wordCount}`,
      `行数：${stats.lineCount}`,
      `非空行数：${stats.nonEmptyLines}`,
      `段落数：${stats.paragraphCount}`,
      `句子数：${stats.sentenceCount}`,
      '',
      '【语言分布】',
      `中文字符数：${stats.chineseChars}（${stats.chineseRatio.toFixed(1)}%）`,
      `英文字符数：${stats.englishChars}（${stats.englishRatio.toFixed(1)}%）`,
      `数字字符数：${stats.digitChars}`,
      '',
      '【阅读信息】',
      `预估阅读时长：${stats.readingMinutes < 1 ? '不到 1 分钟' : `约 ${stats.readingMinutes.toFixed(1)} 分钟`}`,
      '',
      '【词频 Top 20】',
      ...stats.wordFrequency.map((w, i) => `${i + 1}. ${w.word} — ${w.count} 次`),
      '',
      '---',
      '报告由文本工具箱生成',
    ];

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '文本统计报告.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast.success('统计报告已导出');
  }, [text, stats]);

  /** 清空 */
  const handleClear = useCallback(() => {
    setText('');
    toast.info('已清空');
  }, []);

  /** 加载示例 */
  const handleLoadSample = useCallback(() => {
    setText(SAMPLE_TEXT);
    toast.success('已加载示例文本');
  }, []);

  /** 统计卡片数据 */
  const statCards = [
    { label: '总字符数', value: stats.totalChars, icon: Type, color: 'text-primary', bg: 'bg-primary/10' },
    { label: '字数', value: stats.wordCount, icon: Hash, color: 'text-info', bg: 'bg-info/10' },
    { label: '行数', value: stats.lineCount, icon: AlignLeft, color: 'text-success', bg: 'bg-success/10' },
    { label: '段落数', value: stats.paragraphCount, icon: FileText, color: 'text-warning', bg: 'bg-warning/10' },
  ];

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-3">
            <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/15 text-primary">
              <BarChart3 className="w-5 h-5" />
            </span>
            文本统计
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            快速统计文本的字符、字数、行数、段落数，分析中英文占比和词频
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleLoadSample}>
            <Sparkles className="w-4 h-4 mr-2" />
            示例文本
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            <RefreshCw className="w-4 h-4 mr-2" />
            清空
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：输入区 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-3 space-y-4"
        >
          <Card className="border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/60 dark:border-white/10">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold">输入文本</CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 px-2">
                    {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleExport} className="h-8 px-2">
                    <Download className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              <CardDescription className="text-xs">
                共 {stats.totalChars} 字符 · {stats.lineCount} 行
                {isTrial && <span className="ml-2 text-warning">（试用版无字数限制）</span>}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="在此输入或粘贴文本..."
                className="min-h-[400px] resize-y font-mono text-sm leading-relaxed bg-white/70 dark:bg-slate-800/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：统计结果 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* 基础统计卡片 */}
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 + i * 0.05 }}
                >
                  <Card className="border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/60 dark:border-white/10 h-full">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg', card.bg)}>
                          <Icon className={cn('w-5 h-5', card.color)} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs text-muted-foreground">{card.label}</div>
                          <div className="text-xl font-bold text-foreground tabular-nums">
                            {stats.totalChars === 0 ? '—' : card.value.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          {/* 语言分布 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.45 }}
          >
            <Card className="border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/60 dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Languages className="w-4 h-4 text-primary" />
                  语言分布
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">中文</span>
                    <span className="font-medium tabular-nums">
                      {stats.chineseChars} 字符 · {stats.chineseRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.chineseRatio}%` }}
                      transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">英文</span>
                    <span className="font-medium tabular-nums">
                      {stats.englishChars} 字符 · {stats.englishRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${stats.englishRatio}%` }}
                      transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-info to-info/70 rounded-full"
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm pt-2 border-t border-border/30">
                  <span className="text-muted-foreground">数字</span>
                  <span className="font-medium tabular-nums">{stats.digitChars} 字符</span>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* 阅读时长 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.55 }}
          >
            <Card className="border-white/20 bg-gradient-to-br from-primary/10 via-white/60 to-info/10 backdrop-blur-xl shadow-md dark:from-primary/20 dark:via-slate-900/60 dark:to-info/20 dark:border-white/10">
              <CardContent className="p-5">
                <div className="flex items-center gap-4">
                  <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/20 text-primary">
                    <Clock className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">预估阅读时长</div>
                    <div className="text-2xl font-bold text-foreground">
                      {stats.totalChars === 0
                        ? '—'
                        : stats.readingMinutes < 1
                        ? '不到 1 分钟'
                        : `约 ${stats.readingMinutes.toFixed(1)} 分钟`}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      </div>

      {/* 词频分析 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/60 dark:border-white/10">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                词频统计 Top 20
              </CardTitle>
              <Badge variant="outline" className="text-xs">
                {stats.wordFrequency.length} 个词条
              </Badge>
            </div>
            <CardDescription className="text-xs">
              中文按单字统计，英文按单词统计（不区分大小写）
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats.wordFrequency.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                输入文本后自动统计词频
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {stats.wordFrequency.slice(0, 20).map((item, i) => (
                  <motion.div
                    key={item.word}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: 0.05 * i }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 border border-border/30 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-medium text-muted-foreground shrink-0 w-5">
                        {i + 1}
                      </span>
                      <span className="text-sm font-medium text-foreground truncate">{item.word}</span>
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 ml-2">
                      {item.count}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* 详细统计 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <Card className="border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/60 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">详细统计</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {[
                { label: '总字符数（含空格）', value: stats.totalChars },
                { label: '总字符数（不含空格）', value: stats.charsNoSpace },
                { label: '中文字符', value: stats.chineseChars },
                { label: '英文字符', value: stats.englishChars },
                { label: '数字字符', value: stats.digitChars },
                { label: '字数', value: stats.wordCount },
                { label: '行数', value: stats.lineCount },
                { label: '非空行', value: stats.nonEmptyLines },
                { label: '段落数', value: stats.paragraphCount },
                { label: '句子数', value: stats.sentenceCount },
                { label: '中文占比', value: `${stats.chineseRatio.toFixed(1)}%` },
                { label: '英文占比', value: `${stats.englishRatio.toFixed(1)}%` },
              ].map((item, i) => (
                <div key={i} className="space-y-1">
                  <div className="text-xs text-muted-foreground">{item.label}</div>
                  <div className="text-sm font-semibold text-foreground tabular-nums">
                    {typeof item.value === 'number' ? item.value.toLocaleString() : item.value}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
