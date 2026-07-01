import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scissors,
  Upload,
  FileText,
  X,
  Download,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  FileDown,
  Check,
  Copy,
  RotateCcw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { splitPdf, loadPdf, type ISplitRange } from '@/utils/pdf-lib';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

/** 页码范围 */
interface PageRange {
  id: string;
  start: string;
  end: string;
}

/** 拆分结果文件 */
interface SplitResult {
  name: string;
  blob: Blob;
  pages: string;
}

export default function SplitPage() {
  const { isTrial, trialLimits } = useLicense();
  const [file, setFile] = useState<File | null>(null);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [fileName, setFileName] = useState<string>('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<SplitResult[]>([]);

  // 拆分模式
  const [splitMode, setSplitMode] = useState<'range' | 'perPage'>('range');
  // 页码范围列表
  const [ranges, setRanges] = useState<PageRange[]>([
    { id: '1', start: '', end: '' },
  ]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 处理文件选择 */
  const handleFileSelect = useCallback(
    async (f: File) => {
      if (!f.name.toLowerCase().endsWith('.pdf')) {
        toast.error('请选择 PDF 文件');
        return;
      }

      setFile(f);
      setFileName(f.name);
      setResults([]);
      setProgress(0);
      setTotalPages(0);

      try {
        const { pageCount } = await loadPdf(f);
        setTotalPages(pageCount);
      } catch (err) {
        toast.error(`读取 PDF 失败：${String(err?.message || err)}`);
        setFile(null);
        setFileName('');
      }
    },
    [],
  );

  /** 拖拽事件 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileSelect(files[0]);
      }
    },
    [handleFileSelect],
  );

  /** 移除文件 */
  const handleRemoveFile = useCallback(() => {
    setFile(null);
    setTotalPages(0);
    setFileName('');
    setResults([]);
    setProgress(0);
    setRanges([{ id: '1', start: '', end: '' }]);
  }, []);

  /** 添加范围 */
  const handleAddRange = useCallback(() => {
    setRanges((prev) => [
      ...prev,
      { id: Date.now().toString(), start: '', end: '' },
    ]);
  }, []);

  /** 删除范围 */
  const handleRemoveRange = useCallback((id: string) => {
    setRanges((prev) => prev.filter((r) => r.id !== id));
  }, []);

  /** 更新范围 */
  const handleRangeChange = useCallback(
    (id: string, field: 'start' | 'end', value: string) => {
      const numValue = value.replace(/[^0-9]/g, '');
      setRanges((prev) =>
        prev.map((r) => (r.id === id ? { ...r, [field]: numValue } : r)),
      );
    },
    [],
  );

  /** 校验范围 */
  const validateRanges = useCallback((): { valid: boolean; message: string } => {
    if (splitMode === 'perPage') {
      if (totalPages === 0) {
        return { valid: false, message: '请先上传 PDF 文件' };
      }
      return { valid: true, message: '' };
    }

    if (ranges.length === 0) {
      return { valid: false, message: '请至少添加一个页码范围' };
    }

    for (const r of ranges) {
      const s = parseInt(r.start, 10);
      const e = parseInt(r.end, 10);
      if (!r.start || !r.end) {
        return { valid: false, message: '请填写完整的页码范围' };
      }
      if (s < 1 || e > totalPages) {
        return {
          valid: false,
          message: `页码范围必须在 1-${totalPages} 之间`,
        };
      }
      if (s > e) {
        return { valid: false, message: '起始页不能大于结束页' };
      }
    }

    return { valid: true, message: '' };
  }, [splitMode, ranges, totalPages]);

  /** 计算拆分出的文件数量 */
  const splitCount = useMemo(() => {
    if (splitMode === 'perPage') return totalPages;
    return ranges.filter((r) => r.start && r.end).length;
  }, [splitMode, totalPages, ranges]);

  /** 开始拆分 */
  const handleSplit = useCallback(async () => {
    if (!file) {
      toast.error('请先上传 PDF 文件');
      return;
    }

    const { valid, message } = validateRanges();
    if (!valid) {
      toast.error(message);
      return;
    }

    if (isTrial && splitCount > trialLimits.pdfMaxPages) {
      toast.warning(
        `试用版最多拆分 ${trialLimits.pdfMaxPages} 个文件，激活后解锁无限制`,
      );
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResults([]);

    try {
      let splitRanges: ISplitRange[];
      if (splitMode === 'perPage') {
        const count = isTrial
          ? Math.min(totalPages, trialLimits.pdfMaxPages)
          : totalPages;
        splitRanges = Array.from({ length: count }, (_, i) => ({
          start: i + 1,
          end: i + 1,
        }));
      } else {
        splitRanges = ranges
          .filter((r) => r.start && r.end)
          .map((r) => ({
            start: parseInt(r.start, 10),
            end: parseInt(r.end, 10),
          }));
      }

      const resultsArr = await splitPdf(
        file,
        splitRanges,
        (percent) => setProgress(percent),
        isTrial && trialLimits.addWatermark,
      );

      const resultList: SplitResult[] = resultsArr.map((r, i) => ({
        name: r.fileName,
        blob: r.blob,
        pages:
          splitMode === 'perPage'
            ? `第 ${i + 1} 页`
            : `第 ${splitRanges[i]?.start || i + 1}-${splitRanges[i]?.end || i + 1} 页`,
      }));

      setResults(resultList);
      setProgress(100);
      toast.success(`成功拆分为 ${resultList.length} 个 PDF 文件`);
    } catch (err) {
      toast.error(`拆分失败：${String(err?.message || err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [
    file,
    validateRanges,
    isTrial,
    trialLimits.pdfMaxPages,
    trialLimits.addWatermark,
    splitCount,
    splitMode,
    ranges,
    totalPages,
  ]);

  /** 下载单个文件 */
  const handleDownload = useCallback((result: SplitResult) => {
    const url = URL.createObjectURL(result.blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('下载成功');
  }, []);

  /** 批量下载（打包为ZIP） */
  const handleDownloadAll = useCallback(async () => {
    if (results.length === 0) return;
    results.forEach((r, i) => {
      setTimeout(() => handleDownload(r), i * 200);
    });
    toast.success(`正在下载 ${results.length} 个文件`);
  }, [results, handleDownload]);

  /** 重置 */
  const handleReset = useCallback(() => {
    handleRemoveFile();
  }, [handleRemoveFile]);

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
              <Scissors className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">PDF拆分</h1>
            <p className="text-sm text-muted-foreground">
              按页码范围或每页拆分，批量导出多个PDF文件
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {results.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              重新拆分
            </Button>
          )}
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 限{trialLimits.pdfMaxPages}个
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：上传 + 文件信息 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* 上传区 */}
          {!file ? (
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardContent className="p-0">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'cursor-pointer rounded-xl p-8 transition-all duration-300 text-center',
                    isDragging
                      ? 'bg-primary/10 border-2 border-dashed border-primary/50 scale-[1.02]'
                      : 'border-2 border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        handleFileSelect(e.target.files[0]);
                      }
                    }}
                  />
                  <div className="flex flex-col items-center gap-3">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg" />
                      <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                        <Upload className="h-7 w-7 text-primary" />
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        拖拽 PDF 文件到此处
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        或点击选择文件，支持 .pdf 格式
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 shrink-0">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{fileName}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {(file.size / 1024).toFixed(1)} KB · 共 {totalPages} 页
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 试用版提示 */}
          {isTrial && file && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
              className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-start gap-3"
            >
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="text-sm font-medium text-foreground">试用版限制</div>
                <div className="text-xs text-muted-foreground mt-1">
                  试用版最多拆分 {trialLimits.pdfMaxPages} 个文件，导出文件含试用水印。激活后解锁全部功能。
                </div>
              </div>
              <Sparkles className="h-4 w-4 text-primary shrink-0 mt-1" />
            </motion.div>
          )}
        </motion.div>

        {/* 右侧：拆分设置 + 结果 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-3 space-y-4"
        >
          {/* 拆分模式 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">拆分方式</CardTitle>
              <CardDescription className="text-xs">
                选择拆分模式，按页码范围或每页拆分
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs
                value={splitMode}
                onValueChange={(v) => setSplitMode(v as 'range' | 'perPage')}
                className="w-full"
              >
                <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                  <TabsTrigger value="range" className="text-sm">
                    按页码范围
                  </TabsTrigger>
                  <TabsTrigger value="perPage" className="text-sm">
                    每页拆分
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="range" className="mt-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">页码范围</Label>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddRange}
                      className="h-7 gap-1 text-xs"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      添加范围
                    </Button>
                  </div>

                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    <AnimatePresence initial={false}>
                      {ranges.map((range, index) => (
                        <motion.div
                          key={range.id}
                          initial={{ opacity: 0, height: 0, y: -10 }}
                          animate={{ opacity: 1, height: 'auto', y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                          className="flex items-center gap-2"
                        >
                          <span className="text-xs text-muted-foreground w-6 shrink-0">
                            #{index + 1}
                          </span>
                          <Input
                            type="text"
                            value={range.start}
                            onChange={(e) =>
                              handleRangeChange(range.id, 'start', e.target.value)
                            }
                            placeholder="起始页"
                            className="h-9 text-sm bg-background/50"
                          />
                          <span className="text-muted-foreground text-sm">—</span>
                          <Input
                            type="text"
                            value={range.end}
                            onChange={(e) =>
                              handleRangeChange(range.id, 'end', e.target.value)
                            }
                            placeholder="结束页"
                            className="h-9 text-sm bg-background/50"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveRange(range.id)}
                            disabled={ranges.length === 1}
                            className="h-9 w-9 shrink-0 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {totalPages > 0 && (
                    <p className="text-xs text-muted-foreground">
                      提示：文件共 {totalPages} 页，页码范围在 1-{totalPages} 之间
                    </p>
                  )}
                </TabsContent>

                <TabsContent value="perPage" className="mt-4">
                  <div className="rounded-xl border border-border/40 bg-muted/30 p-4 text-center">
                    <FileDown className="h-8 w-8 text-primary mx-auto mb-2" />
                    <p className="text-sm font-medium text-foreground">
                      每页拆分为一个独立 PDF
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {totalPages > 0
                        ? `将生成 ${totalPages} 个 PDF 文件`
                        : '上传文件后自动计算页数'}
                    </p>
                  </div>
                </TabsContent>
              </Tabs>

              {/* 拆分按钮 */}
              <Button
                onClick={handleSplit}
                disabled={!file || isProcessing}
                className="w-full h-11 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    拆分中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Scissors className="h-4 w-4" />
                    开始拆分
                  </span>
                )}
              </Button>

              {/* 进度条 */}
              {isProcessing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground text-center">
                    正在拆分 PDF... {progress}%
                  </p>
                </motion.div>
              )}
            </CardContent>
          </Card>

          {/* 拆分结果 */}
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-semibold flex items-center gap-2">
                        <Check className="h-4 w-4 text-success" />
                        拆分完成
                        <Badge variant="outline" className="text-xs font-normal ml-1">
                          共 {results.length} 个文件
                        </Badge>
                      </CardTitle>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleDownloadAll}
                      className="gap-1.5 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90"
                    >
                      <Download className="h-3.5 w-3.5" />
                      全部下载
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                    {results.map((result, i) => (
                      <motion.div
                        key={result.name}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.3, delay: 0.05 * i }}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/30 bg-background/30 hover:bg-background/50 transition-colors"
                      >
                        <div className="flex items-center justify-center w-9 h-9 rounded-md bg-primary/10 shrink-0">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {result.name}
                          </p>
                          <p className="text-xs text-muted-foreground">{result.pages}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(result)}
                          className="h-8 w-8 shrink-0 hover:bg-primary/10 hover:text-primary"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
