import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitCompare,
  FileText,
  Copy,
  Download,
  Check,
  AlignLeft,
  Type,
  Space,
  CaseSensitive,
  ArrowLeftRight,
  RefreshCw,
  Columns,
  FileCode,
  Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import {
  diffChars,
  diffLines,
  generateDiffHtmlReport,
  copyToClipboard,
  type DiffResult,
  type DiffOptions,
} from '@/utils/text-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

/** 示例文本 */
const SAMPLE_LEFT = `欢迎使用文本对比工具
这是第一段文本，用于演示对比功能
你可以在左右两栏输入不同的内容
系统会自动高亮显示差异
支持逐字和逐行两种对比模式
还可以选择忽略空格和大小写
这是一个纯前端工具，保护你的隐私`;

const SAMPLE_RIGHT = `欢迎使用文本对比工具箱
这是第一段文字，用于演示对比效果
你可以在左右两栏输入不同的内容
系统会自动高亮显示差异内容
支持逐字和逐行两种对比模式
还可以选择忽略空格和大小写选项
这是一个纯前端本地工具，保护您的隐私`;

export default function DiffPage() {
  const { isTrial, trialLimits } = useLicense();

  // 输入文本
  const [leftText, setLeftText] = useState(SAMPLE_LEFT);
  const [rightText, setRightText] = useState(SAMPLE_RIGHT);

  // 对比模式
  const [mode, setMode] = useState<'char' | 'line'>('line');

  // 选项
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);

  // 视图模式：并排 / 统一
  const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');

  // 滚动同步
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const isSyncing = useRef(false);

  /** 计算对比结果 */
  const diffResult = useMemo<DiffResult>(() => {
    const options: DiffOptions = {
      mode,
      ignoreWhitespace,
      ignoreCase,
    };

    // 试用版字数限制
    if (isTrial) {
      const maxChars = trialLimits.maxDiffChars;
      const limitedLeft = leftText.slice(0, maxChars);
      const limitedRight = rightText.slice(0, maxChars);
      if (leftText.length > maxChars || rightText.length > maxChars) {
        toast.warning(`试用版最多对比 ${maxChars} 字符，已自动截取`);
      }
      if (mode === 'char') {
        return diffChars(limitedLeft, limitedRight, options);
      }
      return diffLines(limitedLeft, limitedRight, options);
    }

    if (mode === 'char') {
      return diffChars(leftText, rightText, options);
    }
    return diffLines(leftText, rightText, options);
  }, [leftText, rightText, mode, ignoreWhitespace, ignoreCase, isTrial, trialLimits.maxDiffChars]);

  /** 同步滚动 */
  const handleScroll = useCallback((source: 'left' | 'right') => {
    if (isSyncing.current) return;
    isSyncing.current = true;

    const leftEl = leftRef.current;
    const rightEl = rightRef.current;
    if (!leftEl || !rightEl) return;

    const sourceEl = source === 'left' ? leftEl : rightEl;
    const targetEl = source === 'left' ? rightEl : leftEl;

    const scrollRatio = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
    targetEl.scrollTop = scrollRatio * (targetEl.scrollHeight - targetEl.clientHeight);

    requestAnimationFrame(() => {
      isSyncing.current = false;
    });
  }, []);

  /** 复制左侧文本 */
  const handleCopyLeft = useCallback(async () => {
    const ok = await copyToClipboard(leftText);
    if (ok) toast.success('已复制到剪贴板');
    else toast.error('复制失败');
  }, [leftText]);

  /** 复制右侧文本 */
  const handleCopyRight = useCallback(async () => {
    const ok = await copyToClipboard(rightText);
    if (ok) toast.success('已复制到剪贴板');
    else toast.error('复制失败');
  }, [rightText]);

  /** 交换左右文本 */
  const handleSwap = useCallback(() => {
    setLeftText(rightText);
    setRightText(leftText);
  }, [leftText, rightText]);

  /** 清空文本 */
  const handleClear = useCallback(() => {
    setLeftText('');
    setRightText('');
  }, []);

  /** 重置为示例 */
  const handleResetSample = useCallback(() => {
    setLeftText(SAMPLE_LEFT);
    setRightText(SAMPLE_RIGHT);
  }, []);

  /** 导出HTML报告 */
  const handleExportHtml = useCallback(() => {
    const html = generateDiffHtmlReport(diffResult, {
      leftTitle: '原始文本',
      rightTitle: '修改后文本',
      mode,
    });
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `diff_report_${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('HTML 报告已导出');
  }, [diffResult, mode]);

  /** 渲染行级差异 - 并排视图 */
  const renderLineDiffSideBySide = useCallback(() => {
    const { lines } = diffResult;
    return (
      <div className="grid grid-cols-2 gap-0 h-full">
        {/* 左侧 */}
        <div
          ref={leftRef}
          onScroll={() => handleScroll('left')}
          className="overflow-auto border-r border-border/50 font-mono text-sm"
        >
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={`l-${idx}`}
                  className={cn(
                    'border-b border-border/30',
                    line.type === 'removed' && 'bg-destructive/10',
                    line.type === 'added' && 'bg-muted/30',
                    line.type === 'unchanged' && 'hover:bg-muted/20',
                  )}
                >
                  <td className="w-12 px-2 py-1 text-right text-xs text-muted-foreground select-none border-r border-border/30 bg-muted/20">
                    {line.leftLine || ''}
                  </td>
                  <td className="px-3 py-1 whitespace-pre-wrap break-all align-top">
                    {line.type === 'removed' ? (
                      <span className="text-destructive">
                        {line.leftContent || ' '}
                      </span>
                    ) : line.type === 'added' ? (
                      <span className="text-muted-foreground/30">{' '}</span>
                    ) : (
                      <span>{line.leftContent || ' '}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {/* 右侧 */}
        <div
          ref={rightRef}
          onScroll={() => handleScroll('right')}
          className="overflow-auto font-mono text-sm"
        >
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, idx) => (
                <tr
                  key={`r-${idx}`}
                  className={cn(
                    'border-b border-border/30',
                    line.type === 'added' && 'bg-success/10',
                    line.type === 'removed' && 'bg-muted/30',
                    line.type === 'unchanged' && 'hover:bg-muted/20',
                  )}
                >
                  <td className="w-12 px-2 py-1 text-right text-xs text-muted-foreground select-none border-r border-border/30 bg-muted/20">
                    {line.rightLine || ''}
                  </td>
                  <td className="px-3 py-1 whitespace-pre-wrap break-all align-top">
                    {line.type === 'added' ? (
                      <span className="text-success-foreground" style={{ color: 'hsl(130 54% 42%)' }}>
                        {line.rightContent || ' '}
                      </span>
                    ) : line.type === 'removed' ? (
                      <span className="text-muted-foreground/30">{' '}</span>
                    ) : (
                      <span>{line.rightContent || ' '}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [diffResult, handleScroll]);

  /** 渲染字级差异 */
  const renderCharDiff = useCallback(() => {
    const { segments } = diffResult;
    return (
      <div className="h-full overflow-auto p-4 font-mono text-sm leading-relaxed whitespace-pre-wrap break-all">
        {segments.map((seg, idx) => {
          if (seg.type === 'added') {
            return (
              <span
                key={idx}
                className="bg-success/20 text-success-foreground rounded-sm px-0.5"
                style={{ color: 'hsl(130 54% 42%)' }}
              >
                {seg.value}
              </span>
            );
          }
          if (seg.type === 'removed') {
            return (
              <span
                key={idx}
                className="bg-destructive/20 text-destructive line-through rounded-sm px-0.5"
              >
                {seg.value}
              </span>
            );
          }
          return <span key={idx}>{seg.value}</span>;
        })}
      </div>
    );
  }, [diffResult]);

  /** 渲染统一视图 */
  const renderUnifiedView = useCallback(() => {
    const { lines } = diffResult;
    return (
      <div className="h-full overflow-auto font-mono text-sm">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr
                key={idx}
                className={cn(
                  'border-b border-border/30',
                  line.type === 'added' && 'bg-success/10',
                  line.type === 'removed' && 'bg-destructive/10',
                  line.type === 'unchanged' && 'hover:bg-muted/20',
                )}
              >
                <td className="w-6 px-1 py-1 text-center text-xs select-none border-r border-border/30 bg-muted/20">
                  {line.type === 'added' && <span className="text-success-foreground" style={{ color: 'hsl(130 54% 42%)' }}>+</span>}
                  {line.type === 'removed' && <span className="text-destructive">-</span>}
                  {line.type === 'unchanged' && <span className="text-muted-foreground/50"> </span>}
                </td>
                <td className="w-10 px-2 py-1 text-right text-xs text-muted-foreground select-none border-r border-border/30 bg-muted/10">
                  {line.leftLine || ''}
                </td>
                <td className="w-10 px-2 py-1 text-right text-xs text-muted-foreground select-none border-r border-border/30 bg-muted/10">
                  {line.rightLine || ''}
                </td>
                <td className="px-3 py-1 whitespace-pre-wrap break-all align-top">
                  {line.type === 'added' ? (
                    <span style={{ color: 'hsl(130 54% 42%)' }}>{line.rightContent || ' '}</span>
                  ) : line.type === 'removed' ? (
                    <span className="text-destructive">{line.leftContent || ' '}</span>
                  ) : (
                    <span>{line.leftContent || ' '}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [diffResult]);

  /** 统计信息 */
  const stats = useMemo(() => {
    const leftLen = leftText.length;
    const rightLen = rightText.length;
    const leftLines = leftText ? leftText.split('\n').length : 0;
    const rightLines = rightText ? rightText.split('\n').length : 0;
    return { leftLen, rightLen, leftLines, rightLines };
  }, [leftText, rightText]);

  return (
    <div className="space-y-6">
      {/* 顶部标题区 */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col md:flex-row md:items-center md:justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="absolute inset-0 rounded-xl bg-primary/30 blur-xl" />
            <div className="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg">
              <GitCompare className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">文本对比</h1>
            <p className="text-sm text-muted-foreground">
              实时高亮两段文本的差异，支持逐字和逐行对比
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSwap}
            className="gap-2"
          >
            <ArrowLeftRight className="h-4 w-4" />
            交换
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleResetSample}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            示例
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleClear}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            清空
          </Button>
          <Button
            onClick={handleExportHtml}
            size="sm"
            className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
          >
            <FileCode className="h-4 w-4" />
            导出报告
          </Button>
        </div>
      </motion.div>

      {/* 选项卡 + 选项 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {/* 对比模式切换 */}
              <Tabs
                value={mode}
                onValueChange={(v) => setMode(v as 'char' | 'line')}
                className="w-auto"
              >
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="line" className="gap-2">
                    <AlignLeft className="h-4 w-4" />
                    逐行对比
                  </TabsTrigger>
                  <TabsTrigger value="char" className="gap-2">
                    <Type className="h-4 w-4" />
                    逐字对比
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* 视图模式（仅逐行时显示） */}
              <div className="flex items-center gap-4 flex-wrap">
                {mode === 'line' && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">视图：</span>
                    <div className="flex rounded-lg bg-muted/50 p-0.5">
                      <button
                        onClick={() => setViewMode('side-by-side')}
                        className={cn(
                          'px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1.5',
                          viewMode === 'side-by-side'
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <Columns className="h-3.5 w-3.5" />
                        并排
                      </button>
                      <button
                        onClick={() => setViewMode('unified')}
                        className={cn(
                          'px-3 py-1 text-xs rounded-md transition-all flex items-center gap-1.5',
                          viewMode === 'unified'
                            ? 'bg-background shadow-sm text-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        统一
                      </button>
                    </div>
                  </div>
                )}

                {/* 忽略选项 */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ignore-space"
                      checked={ignoreWhitespace}
                      onCheckedChange={setIgnoreWhitespace}
                    />
                    <Label htmlFor="ignore-space" className="text-sm cursor-pointer flex items-center gap-1.5">
                      <Space className="h-3.5 w-3.5 text-muted-foreground" />
                      忽略空格
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="ignore-case"
                      checked={ignoreCase}
                      onCheckedChange={setIgnoreCase}
                    />
                    <Label htmlFor="ignore-case" className="text-sm cursor-pointer flex items-center gap-1.5">
                      <CaseSensitive className="h-3.5 w-3.5 text-muted-foreground" />
                      忽略大小写
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 输入区 + 结果区 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左侧输入 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="h-full flex flex-col border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">原始文本</CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  {stats.leftLines} 行 · {stats.leftLen} 字
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyLeft}
                className="h-8 w-8"
                title="复制"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <Textarea
                value={leftText}
                onChange={(e) => setLeftText(e.target.value)}
                placeholder="在此输入或粘贴原始文本..."
                className="min-h-[300px] h-[300px] font-mono text-sm resize-none bg-background/50 border-border/50 focus:border-primary/50"
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧输入 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
        >
          <Card className="h-full flex flex-col border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base font-semibold">修改后文本</CardTitle>
                <Badge variant="outline" className="text-xs font-normal">
                  {stats.rightLines} 行 · {stats.rightLen} 字
                </Badge>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleCopyRight}
                className="h-8 w-8"
                title="复制"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent className="flex-1 pt-0">
              <Textarea
                value={rightText}
                onChange={(e) => setRightText(e.target.value)}
                placeholder="在此输入或粘贴修改后的文本..."
                className="min-h-[300px] h-[300px] font-mono text-sm resize-none bg-background/50 border-border/50 focus:border-primary/50"
              />
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* 差异统计 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">新增</div>
            <div className="text-2xl font-bold" style={{ color: 'hsl(130 54% 42%)' }}>
              +{diffResult.addedCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {mode === 'line' ? '行' : '字'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">删除</div>
            <div className="text-2xl font-bold text-destructive">
              -{diffResult.removedCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {mode === 'line' ? '行' : '字'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">未变</div>
            <div className="text-2xl font-bold text-foreground">
              {diffResult.unchangedCount}
              <span className="text-sm font-normal text-muted-foreground ml-1">
                {mode === 'line' ? '行' : '字'}
              </span>
            </div>
          </CardContent>
        </Card>
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground mb-1">差异率</div>
            <div className="text-2xl font-bold text-primary">
              {diffResult.unchangedCount + diffResult.addedCount + diffResult.removedCount > 0
                ? (
                    ((diffResult.addedCount + diffResult.removedCount) /
                      (diffResult.unchangedCount + diffResult.addedCount + diffResult.removedCount)) *
                    100
                  ).toFixed(1)
                : 0}
              <span className="text-sm font-normal text-muted-foreground ml-1">%</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 对比结果区 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-primary" />
              对比结果
            </CardTitle>
            <Badge variant="secondary" className="text-xs">
              {mode === 'line' ? '逐行对比' : '逐字对比'}
            </Badge>
          </CardHeader>
          <CardContent className="pt-0 p-0">
            <div className="border-t border-border/30 h-[500px] overflow-hidden rounded-b-xl">
              <AnimatePresence mode="wait">
                {mode === 'char' ? (
                  <motion.div
                    key="char"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    {renderCharDiff()}
                  </motion.div>
                ) : viewMode === 'side-by-side' ? (
                  <motion.div
                    key="side"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    {renderLineDiffSideBySide()}
                  </motion.div>
                ) : (
                  <motion.div
                    key="unified"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="h-full"
                  >
                    {renderUnifiedView()}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 试用版提示 */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <FileText className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版限制</div>
            <div className="text-xs text-muted-foreground">
              文本对比最多 {trialLimits.maxDiffChars} 字符，导出的 HTML 报告含试用水印。激活后解锁全部功能。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
