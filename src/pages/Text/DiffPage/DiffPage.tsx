import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  GitCompare,
  Copy,
  Check,
  Download,
  Trash2,
  FileText,
  Sparkles,
  Eye,
  ArrowLeftRight,
  Type,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

/* ============================================================
 *  差异计算工具函数
 * ============================================================ */

/** 差异块类型 */
type DiffBlock = {
  type: 'equal' | 'added' | 'removed';
  content: string;
};

/**
 * 计算两个字符串的逐字差异（LCS 算法）
 */
function diffChars(a: string, b: string): DiffBlock[] {
  const m = a.length;
  const n = b.length;
  const MAX_COMPARE = 2000;

  // 文本过长时降级为简单逐段比较，避免性能问题
  if (m > MAX_COMPARE || n > MAX_COMPARE) {
    if (a === b) return [{ type: 'equal', content: a }];
    return [
      { type: 'removed', content: a },
      { type: 'added', content: b },
    ];
  }

  // 构建 LCS 矩阵
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯生成差异块
  const blocks: DiffBlock[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      pushBlock(blocks, 'equal', a[i - 1]);
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      pushBlock(blocks, 'added', b[j - 1]);
      j--;
    } else {
      pushBlock(blocks, 'removed', a[i - 1]);
      i--;
    }
  }

  return blocks.reverse();
}

/**
 * 计算两个字符串的逐行差异
 */
function diffLines(a: string, b: string): { left: DiffLine[]; right: DiffLine[] } {
  const linesA = a.split('\n');
  const linesB = b.split('\n');
  const m = linesA.length;
  const n = linesB.length;
  const MAX_LINES = 500;

  if (m > MAX_LINES || n > MAX_LINES) {
    return {
      left: linesA.map((text) => ({ text, type: 'removed' as const })),
      right: linesB.map((text) => ({ type: 'added' as const, text })),
    };
  }

  // LCS 矩阵
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (linesA[i - 1] === linesB[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯
  const left: DiffLine[] = [];
  const right: DiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      left.unshift({ text: linesA[i - 1], type: 'equal' });
      right.unshift({ text: linesB[j - 1], type: 'equal' });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      left.unshift({ text: '', type: 'empty' });
      right.unshift({ text: linesB[j - 1], type: 'added' });
      j--;
    } else {
      left.unshift({ text: linesA[i - 1], type: 'removed' });
      right.unshift({ text: '', type: 'empty' });
      i--;
    }
  }

  return { left, right };
}

type DiffLine = {
  text: string;
  type: 'equal' | 'added' | 'removed' | 'empty';
};

/** 向差异块数组追加字符，相同类型合并 */
function pushBlock(blocks: DiffBlock[], type: DiffBlock['type'], char: string) {
  if (blocks.length > 0 && blocks[0].type === type) {
    blocks[0].content = char + blocks[0].content;
  } else {
    blocks.unshift({ type, content: char });
  }
}

/* ============================================================
 *  页面组件
 * ============================================================ */

export default function TextDiffPage() {
  const { isTrial, trialLimits } = useLicense();

  const [leftText, setLeftText] = useState('');
  const [rightText, setRightText] = useState('');
  const [diffMode, setDiffMode] = useState<'char' | 'line'>('line');
  const [viewMode, setViewMode] = useState<'split' | 'unified'>('split');
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [ignoreCase, setIgnoreCase] = useState(false);
  const [copied, setCopied] = useState(false);

  const leftRef = useRef<HTMLTextAreaElement>(null);
  const rightRef = useRef<HTMLTextAreaElement>(null);

  /** 规范化文本（根据选项预处理） */
  const normalize = useCallback(
    (text: string): string => {
      let result = text;
      if (ignoreWhitespace) {
        result = result.replace(/\s+/g, ' ').trim();
      }
      if (ignoreCase) {
        result = result.toLowerCase();
      }
      return result;
    },
    [ignoreWhitespace, ignoreCase],
  );

  /** 试用版字数限制检查 */
  const isOverLimit = useMemo(() => {
    if (!isTrial) return false;
    const max = trialLimits.textMaxChars;
    return leftText.length > max || rightText.length > max;
  }, [isTrial, trialLimits.textMaxChars, leftText, rightText]);

  /** 逐字差异结果 */
  const charDiffResult = useMemo(() => {
    if (!leftText && !rightText) return { left: [], right: [] };
    if (isOverLimit) return { left: [], right: [] };

    const leftNorm = normalize(leftText);
    const rightNorm = normalize(rightText);

    if (diffMode !== 'char') return { left: [], right: [] };

    const blocks = diffChars(leftNorm, rightNorm);

    // 拆分为左右两侧显示
    const leftBlocks: DiffBlock[] = [];
    const rightBlocks: DiffBlock[] = [];

    for (const block of blocks) {
      if (block.type === 'equal') {
        leftBlocks.push(block);
        rightBlocks.push(block);
      } else if (block.type === 'removed') {
        leftBlocks.push(block);
      } else if (block.type === 'added') {
        rightBlocks.push(block);
      }
    }

    return { left: leftBlocks, right: rightBlocks };
  }, [leftText, rightText, diffMode, normalize, isOverLimit]);

  /** 逐行差异结果 */
  const lineDiffResult = useMemo(() => {
    if (!leftText && !rightText) return { left: [], right: [] };
    if (isOverLimit) return { left: [], right: [] };
    if (diffMode !== 'line') return { left: [], right: [] };

    const leftNorm = normalize(leftText);
    const rightNorm = normalize(rightText);

    return diffLines(leftNorm, rightNorm);
  }, [leftText, rightText, diffMode, normalize, isOverLimit]);

  /** 统计差异 */
  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    let equal = 0;

    if (diffMode === 'char') {
      const blocks = diffChars(normalize(leftText), normalize(rightText));
      for (const b of blocks) {
        if (b.type === 'added') added += b.content.length;
        else if (b.type === 'removed') removed += b.content.length;
        else equal += b.content.length;
      }
    } else {
      const { left, right } = diffLines(normalize(leftText), normalize(rightText));
      for (const l of left) {
        if (l.type === 'removed') removed++;
      }
      for (const r of right) {
        if (r.type === 'added') added++;
      }
      equal = left.filter((l) => l.type === 'equal').length;
    }

    return { added, removed, equal };
  }, [leftText, rightText, diffMode, normalize]);

  /** 清空左侧 */
  const handleClearLeft = useCallback(() => {
    setLeftText('');
    leftRef.current?.focus();
  }, []);

  /** 清空右侧 */
  const handleClearRight = useCallback(() => {
    setRightText('');
    rightRef.current?.focus();
  }, []);

  /** 交换两侧 */
  const handleSwap = useCallback(() => {
    const temp = leftText;
    setLeftText(rightText);
    setRightText(temp);
  }, [leftText, rightText]);

  /** 复制结果 */
  const handleCopyResult = useCallback(async () => {
    const lines: string[] = [];
    lines.push('=== 文本对比结果 ===');
    lines.push(`对比模式：${diffMode === 'char' ? '逐字对比' : '逐行对比'}`);
    lines.push(`新增：${stats.added} ${diffMode === 'char' ? '字符' : '行'}`);
    lines.push(`删除：${stats.removed} ${diffMode === 'char' ? '字符' : '行'}`);
    lines.push(`相同：${stats.equal} ${diffMode === 'char' ? '字符' : '行'}`);
    lines.push('');

    if (diffMode === 'line') {
      const { left } = lineDiffResult;
      const { right } = lineDiffResult;
      const maxLen = Math.max(left.length, right.length);
      for (let i = 0; i < maxLen; i++) {
        const l = left[i];
        const r = right[i];
        if (l?.type === 'equal' && r?.type === 'equal') {
          lines.push(`  ${l.text}`);
        } else if (l?.type === 'removed') {
          lines.push(`- ${l.text}`);
        } else if (r?.type === 'added') {
          lines.push(`+ ${r.text}`);
        }
      }
    }

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败');
    }
  }, [diffMode, stats, lineDiffResult]);

  /** 导出 HTML 报告 */
  const handleExportHtml = useCallback(() => {
    const htmlContent = generateHtmlReport();
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = '文本对比报告.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('对比报告已导出');
  }, []);

  /** 生成 HTML 报告 */
  const generateHtmlReport = (): string => {
    const now = new Date().toLocaleString('zh-CN');
    const modeText = diffMode === 'char' ? '逐字对比' : '逐行对比';

    let bodyContent = '';

    if (diffMode === 'line') {
      const { left } = lineDiffResult;
      const { right } = lineDiffResult;
      const maxLen = Math.max(left.length, right.length);

      let leftHtml = '';
      let rightHtml = '';

      for (let i = 0; i < maxLen; i++) {
        const l = left[i];
        const r = right[i];

        if (l?.type === 'equal') {
          leftHtml += `<div class="line equal">${escapeHtml(l.text || '&nbsp;')}</div>`;
          rightHtml += `<div class="line equal">${escapeHtml(r?.text || '&nbsp;')}</div>`;
        } else if (l?.type === 'removed') {
          leftHtml += `<div class="line removed">${escapeHtml(l.text)}</div>`;
          rightHtml += `<div class="line empty">&nbsp;</div>`;
        } else if (r?.type === 'added') {
          leftHtml += `<div class="line empty">&nbsp;</div>`;
          rightHtml += `<div class="line added">${escapeHtml(r.text)}</div>`;
        } else {
          leftHtml += `<div class="line">&nbsp;</div>`;
          rightHtml += `<div class="line">&nbsp;</div>`;
        }
      }

      bodyContent = `
        <div class="diff-container split">
          <div class="diff-panel">
            <div class="panel-title">原始文本</div>
            <div class="diff-content">${leftHtml}</div>
          </div>
          <div class="diff-panel">
            <div class="panel-title">修改后文本</div>
            <div class="diff-content">${rightHtml}</div>
          </div>
        </div>
      `;
    } else {
      let leftHtml = '';
      let rightHtml = '';

      for (const block of charDiffResult.left) {
        const cls = block.type === 'removed' ? 'removed' : block.type === 'added' ? 'added' : '';
        leftHtml += `<span class="${cls}">${escapeHtml(block.content)}</span>`;
      }
      for (const block of charDiffResult.right) {
        const cls = block.type === 'removed' ? 'removed' : block.type === 'added' ? 'added' : '';
        rightHtml += `<span class="${cls}">${escapeHtml(block.content)}</span>`;
      }

      bodyContent = `
        <div class="diff-container split">
          <div class="diff-panel">
            <div class="panel-title">原始文本</div>
            <div class="diff-content char-diff">${leftHtml}</div>
          </div>
          <div class="diff-panel">
            <div class="panel-title">修改后文本</div>
            <div class="diff-content char-diff">${rightHtml}</div>
          </div>
        </div>
      `;
    }

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>文本对比报告</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 24px; }
  .report-header { max-width: 1200px; margin: 0 auto 24px; padding: 20px 24px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .report-title { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
  .report-meta { font-size: 13px; color: #64748b; display: flex; gap: 16px; flex-wrap: wrap; }
  .stat-item { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 12px; font-weight: 500; }
  .stat-added { background: #dcfce7; color: #166534; }
  .stat-removed { background: #fee2e2; color: #991b1b; }
  .stat-equal { background: #e0e7ff; color: #3730a3; }
  .diff-container { max-width: 1200px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 1px; background: #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  .diff-panel { background: #fff; min-height: 400px; }
  .panel-title { padding: 12px 16px; font-size: 13px; font-weight: 600; background: #f8fafc; border-bottom: 1px solid #e2e8f0; color: #475569; }
  .diff-content { padding: 12px 0; font-family: 'SF Mono', Consolas, Monaco, monospace; font-size: 13px; line-height: 1.6; }
  .line { padding: 0 16px; white-space: pre-wrap; word-break: break-all; }
  .line.added { background: #dcfce7; }
  .line.removed { background: #fee2e2; }
  .line.empty { background: #f8fafc; }
  .char-diff { padding: 16px; white-space: pre-wrap; word-break: break-all; }
  .char-diff .added { background: #bbf7d0; padding: 1px 0; border-radius: 2px; }
  .char-diff .removed { background: #fecaca; padding: 1px 0; border-radius: 2px; text-decoration: line-through; text-decoration-color: #ef4444; }
  .report-footer { max-width: 1200px; margin: 24px auto 0; text-align: center; font-size: 12px; color: #94a3b8; }
</style>
</head>
<body>
  <div class="report-header">
    <div class="report-title">文本对比报告</div>
    <div class="report-meta">
      <span>生成时间：${now}</span>
      <span>对比模式：${modeText}</span>
      <span class="stat-item stat-added">+ ${stats.added} ${diffMode === 'char' ? '字符' : '行'}</span>
      <span class="stat-item stat-removed">- ${stats.removed} ${diffMode === 'char' ? '字符' : '行'}</span>
      <span class="stat-item stat-equal">= ${stats.equal} ${diffMode === 'char' ? '字符' : '行'}</span>
    </div>
  </div>
  ${bodyContent}
  <div class="report-footer">由全能办公工具生成 · 纯前端本地处理，保护您的隐私</div>
</body>
</html>`;
  };

  /** HTML 转义 */
  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /** 示例文本 */
  const loadExample = useCallback(() => {
    setLeftText(
      `欢迎使用全能办公工具 - 文本对比功能

这是第一段文字，用于演示对比效果。
这是第二段文字，内容保持不变。
这是第三段文字，将被修改。
这是第四段文字，将被删除。
这是第五段文字，内容相同。

感谢使用！`,
    );
    setRightText(
      `欢迎使用全能办公工具 - 文本对比功能

这是第一段文字，用于演示文本对比的效果。
这是第二段文字，内容保持不变。
这是第三段文字，已经被修改过了。
这是第五段文字，内容相同。
这是第六段文字，是新增的内容。

感谢使用全能办公工具！`,
    );
  }, []);

  // 页面加载时加载示例
  useEffect(() => {
    loadExample();
  }, [loadExample]);

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
              <GitCompare className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">文本对比</h1>
            <p className="text-sm text-muted-foreground">
              左右分栏实时高亮差异，支持逐字/逐行模式
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadExample} className="gap-2">
            <FileText className="h-4 w-4" />
            加载示例
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyResult}
            disabled={!leftText && !rightText}
            className="gap-2"
          >
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            复制结果
          </Button>
          <Button
            onClick={handleExportHtml}
            size="sm"
            disabled={!leftText && !rightText}
            className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
          >
            <Download className="h-4 w-4" />
            导出报告
          </Button>
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
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              {/* 对比模式 */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">对比模式</span>
                <Tabs value={diffMode} onValueChange={(v) => setDiffMode(v as 'char' | 'line')} className="w-auto">
                  <TabsList className="bg-muted/50">
                    <TabsTrigger value="line" className="text-sm">逐行对比</TabsTrigger>
                    <TabsTrigger value="char" className="text-sm">逐字对比</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 视图模式 */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-foreground whitespace-nowrap">视图模式</span>
                <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'split' | 'unified')} className="w-auto">
                  <TabsList className="bg-muted/50">
                    <TabsTrigger value="split" className="text-sm">并排视图</TabsTrigger>
                    <TabsTrigger value="unified" className="text-sm">统一视图</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="flex-1" />

              {/* 忽略选项 */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Switch
                    id="ignore-whitespace"
                    checked={ignoreWhitespace}
                    onCheckedChange={setIgnoreWhitespace}
                  />
                  <Label htmlFor="ignore-whitespace" className="text-sm cursor-pointer whitespace-nowrap">
                    忽略空格
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="ignore-case"
                    checked={ignoreCase}
                    onCheckedChange={setIgnoreCase}
                  />
                  <Label htmlFor="ignore-case" className="text-sm cursor-pointer whitespace-nowrap">
                    忽略大小写
                  </Label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 统计信息 */}
      {(leftText || rightText) && !isOverLimit && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="grid grid-cols-3 gap-3"
        >
          <Card className="border border-success/20 bg-success/5 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">新增</div>
              <div className="text-xl font-bold text-success tabular-nums">
                +{stats.added}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {diffMode === 'char' ? '字符' : '行'}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-destructive/20 bg-destructive/5 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">删除</div>
              <div className="text-xl font-bold text-destructive tabular-nums">
                -{stats.removed}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {diffMode === 'char' ? '字符' : '行'}
                </span>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-primary/20 bg-primary/5 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground mb-1">相同</div>
              <div className="text-xl font-bold text-primary tabular-nums">
                {stats.equal}
                <span className="text-xs font-normal text-muted-foreground ml-1">
                  {diffMode === 'char' ? '字符' : '行'}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 试用版超限提示 */}
      {isTrial && isOverLimit && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版字数超限</div>
            <div className="text-xs text-muted-foreground">
              试用版最多支持 {trialLimits.textMaxChars} 字符对比，激活后解锁无限制对比
            </div>
          </div>
          <Badge variant="secondary" className="text-xs">试用版</Badge>
        </motion.div>
      )}

      {/* 输入区 / 对比结果区 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        {/* 左侧：原始文本 */}
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10 overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Type className="h-4 w-4 text-primary" />
                原始文本
              </CardTitle>
              <CardDescription className="text-xs">
                {leftText.length} 字符 · {leftText.split('\n').length} 行
              </CardDescription>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwap}
                className="h-8 w-8"
                title="交换两侧"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleClearLeft}
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="清空"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Textarea
              ref={leftRef}
              value={leftText}
              onChange={(e) => setLeftText(e.target.value)}
              placeholder="在此粘贴或输入原始文本..."
              className="min-h-[400px] resize-none border-0 border-t border-border/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm leading-relaxed p-4"
            />
          </CardContent>
        </Card>

        {/* 右侧：修改后文本 */}
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10 overflow-hidden">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                修改后文本
              </CardTitle>
              <CardDescription className="text-xs">
                {rightText.length} 字符 · {rightText.split('\n').length} 行
              </CardDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleClearRight}
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              title="清空"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <Textarea
              ref={rightRef}
              value={rightText}
              onChange={(e) => setRightText(e.target.value)}
              placeholder="在此粘贴或输入修改后的文本..."
              className="min-h-[400px] resize-none border-0 border-t border-border/30 rounded-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-mono text-sm leading-relaxed p-4"
            />
          </CardContent>
        </Card>
      </motion.div>

      {/* 对比结果预览 */}
      {(leftText || rightText) && !isOverLimit && viewMode === 'split' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" />
                对比结果预览
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {diffMode === 'line' ? (
                <div className="grid grid-cols-2 divide-x divide-border/30">
                  {/* 左侧结果 */}
                  <div className="max-h-[500px] overflow-auto">
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 text-xs font-medium text-muted-foreground z-10">
                      原始文本
                    </div>
                    <div className="font-mono text-sm leading-6">
                      {lineDiffResult.left.map((line, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'px-4 whitespace-pre-wrap break-all',
                            line.type === 'removed' && 'bg-destructive/15 text-destructive',
                            line.type === 'equal' && 'text-foreground',
                            line.type === 'empty' && 'bg-muted/30',
                          )}
                        >
                          {line.text || '\u00A0'}
                        </div>
                      ))}
                    </div>
                  </div>
                  {/* 右侧结果 */}
                  <div className="max-h-[500px] overflow-auto">
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 text-xs font-medium text-muted-foreground z-10">
                      修改后文本
                    </div>
                    <div className="font-mono text-sm leading-6">
                      {lineDiffResult.right.map((line, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            'px-4 whitespace-pre-wrap break-all',
                            line.type === 'added' && 'bg-success/15 text-success',
                            line.type === 'equal' && 'text-foreground',
                            line.type === 'empty' && 'bg-muted/30',
                          )}
                        >
                          {line.text || '\u00A0'}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 divide-x divide-border/30">
                  <div className="max-h-[500px] overflow-auto">
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 text-xs font-medium text-muted-foreground z-10">
                      原始文本
                    </div>
                    <div className="p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-all">
                      {charDiffResult.left.map((block, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            block.type === 'removed' && 'bg-destructive/20 text-destructive line-through decoration-destructive/50',
                            block.type === 'equal' && 'text-foreground',
                          )}
                        >
                          {block.content}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="max-h-[500px] overflow-auto">
                    <div className="sticky top-0 bg-muted/80 backdrop-blur-sm px-4 py-2 text-xs font-medium text-muted-foreground z-10">
                      修改后文本
                    </div>
                    <div className="p-4 font-mono text-sm leading-6 whitespace-pre-wrap break-all">
                      {charDiffResult.right.map((block, idx) => (
                        <span
                          key={idx}
                          className={cn(
                            block.type === 'added' && 'bg-success/20 text-success',
                            block.type === 'equal' && 'text-foreground',
                          )}
                        >
                          {block.content}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
