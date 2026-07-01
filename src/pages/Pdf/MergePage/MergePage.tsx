import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  X,
  Trash2,
  Download,
  GripVertical,
  Sparkles,
  Layers,
  AlertTriangle,
  Check,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { mergePdfs, loadPdf, type IPdfFileInfo } from '@/utils/pdf-lib';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface PdfFileItem {
  id: string;
  file: File;
  name: string;
  size: number;
  pages: number;
  loading: boolean;
  error?: string;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MergePage() {
  const { isTrial, trialLimits } = useLicense();
  const [files, setFiles] = useState<PdfFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [resultName, setResultName] = useState('合并结果.pdf');
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragItemRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const totalPages = files.reduce((sum, f) => sum + f.pages, 0);

  /** 校验文件并添加 */
  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const newFiles: PdfFileItem[] = [];
      const arr = Array.from(fileList);

      for (const f of arr) {
        if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) {
          toast.error(`文件 "${f.name}" 不是 PDF 格式`);
          continue;
        }
        newFiles.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          file: f,
          name: f.name,
          size: f.size,
          pages: 0,
          loading: true,
        });
      }

      if (newFiles.length === 0) return;

      setFiles((prev) => {
        const next = [...prev, ...newFiles];
        // 试用版限制
        if (isTrial && next.length > trialLimits.pdfMaxFiles) {
          toast.warning(`试用版最多上传 ${trialLimits.pdfMaxFiles} 个文件，激活后解锁无限数量`);
          return next.slice(0, trialLimits.pdfMaxFiles);
        }
        return next;
      });

      // 异步加载每个PDF的页数
      newFiles.forEach((item) => {
        loadPdf(item.file)
          .then(({ pageCount }) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id ? { ...f, pages: pageCount, loading: false } : f
              )
            );
          })
          .catch((err) => {
            setFiles((prev) =>
              prev.map((f) =>
                f.id === item.id
                  ? { ...f, loading: false, error: String(err?.message || err) }
                  : f
              )
            );
            toast.error(`文件 "${item.name}" 读取失败`);
          });
      });
    },
    [isTrial, trialLimits.pdfMaxFiles],
  );

  /** 拖拽上传 */
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.length) {
        addFiles(e.target.files);
        e.target.value = '';
      }
    },
    [addFiles],
  );

  /** 删除文件 */
  const removeFile = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }, []);

  /** 清空全部 */
  const clearAll = useCallback(() => {
    setFiles([]);
    setResultUrl(null);
    setProgress(0);
  }, []);

  /** 拖拽排序 - 开始 */
  const handleDragStart = useCallback((index: number) => {
    dragItemRef.current = index;
  }, []);

  const handleDragEnter = useCallback((index: number) => {
    setDragOverIndex(index);
  }, []);

  const handleDragEnd = useCallback(() => {
    const from = dragItemRef.current;
    const to = dragOverIndex;
    dragItemRef.current = null;
    setDragOverIndex(null);

    if (from === null || to === null || from === to) return;

    setFiles((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, [dragOverIndex]);

  /** 上移/下移 */
  const moveFile = useCallback((index: number, direction: -1 | 1) => {
    setFiles((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  /** 合并处理（纯前端 pdf.js + jsPDF 实现） */
  const handleMerge = useCallback(async () => {
    if (files.length < 2) {
      toast.error('请至少上传 2 个 PDF 文件');
      return;
    }

    const hasLoading = files.some((f) => f.loading);
    if (hasLoading) {
      toast.warning('文件正在加载中，请稍候...');
      return;
    }

    const hasError = files.some((f) => f.error);
    if (hasError) {
      toast.error('存在读取失败的文件，请移除后重试');
      return;
    }

    if (isTrial && totalPages > trialLimits.pdfMaxPages) {
      toast.warning(`试用版最多合并 ${trialLimits.pdfMaxPages} 页，激活后解锁无限页数`);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    if (resultUrl) {
      URL.revokeObjectURL(resultUrl);
      setResultUrl(null);
    }

    try {
      const pdfInfos: IPdfFileInfo[] = files.map((f) => ({
        id: f.id,
        file: f.file,
        name: f.name,
        size: f.size,
        pageCount: f.pages,
      }));

      const blob = await mergePdfs(pdfInfos, (percent) => {
        setProgress(percent);
      }, isTrial && trialLimits.addWatermark);

      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      toast.success('合并完成！');
    } catch (err) {
      toast.error(`合并失败：${String(err?.message || err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [files, isTrial, totalPages, trialLimits.pdfMaxPages, trialLimits.addWatermark, resultUrl]);

  /** 下载结果 */
  const handleDownload = useCallback(() => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href = resultUrl;
    a.download = resultName || '合并结果.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('开始下载');
  }, [resultUrl, resultName]);

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
            <h1 className="text-2xl font-bold text-foreground">PDF 合并</h1>
            <p className="text-sm text-muted-foreground">
              上传多个 PDF 文件，调整顺序后一键合并下载
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {files.length > 0 && (
            <Button variant="outline" size="sm" onClick={clearAll} className="gap-2">
              <Trash2 className="h-4 w-4" />
              清空全部
            </Button>
          )}
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 最多 {trialLimits.pdfMaxFiles} 个文件
            </Badge>
          )}
        </div>
      </motion.div>

      {/* 上传区 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card
          className={cn(
            'border-2 border-dashed transition-all duration-300 bg-white/50 backdrop-blur-xl dark:bg-slate-900/40',
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.01] shadow-xl shadow-primary/20'
              : 'border-border/60 hover:border-primary/40 hover:bg-white/70 dark:hover:bg-slate-900/60'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <CardContent className="flex flex-col items-center justify-center py-12 px-6">
            <div className="relative mb-4">
              <div
                className={cn(
                  'absolute inset-0 rounded-full bg-primary/20 blur-xl transition-all duration-300',
                  isDragging ? 'scale-125 opacity-100' : 'scale-100 opacity-60'
                )}
              />
              <div
                className={cn(
                  'relative flex items-center justify-center w-16 h-16 rounded-2xl transition-all duration-300',
                  isDragging
                    ? 'bg-gradient-to-br from-primary to-purple-600 text-white scale-110'
                    : 'bg-primary/10 text-primary'
                )}
              >
                <Upload className="h-8 w-8" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-1">
              {isDragging ? '松开鼠标上传文件' : '拖拽 PDF 文件到此处'}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              或点击下方按钮选择文件，支持多文件同时上传
            </p>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
            >
              <Upload className="h-4 w-4" />
              选择 PDF 文件
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground/70 mt-4">
              所有文件仅在您的浏览器中处理，不会上传到服务器
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* 文件列表 */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, delay: 0.15 }}
          >
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary" />
                    文件列表
                    <Badge variant="outline" className="ml-1 text-xs font-normal">
                      {files.length} 个文件
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    拖拽调整顺序，上方的文件排在合并结果前面
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="text-xs">
                  共 {totalPages} 页
                </Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                {files.map((f, index) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25, delay: index * 0.03 }}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragEnter={() => handleDragEnter(index)}
                    onDragEnd={handleDragEnd}
                    onDragOver={(e) => e.preventDefault()}
                    className={cn(
                      'group flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-move',
                      dragOverIndex === index && dragItemRef.current !== index
                        ? 'border-primary/50 bg-primary/10 scale-[1.01]'
                        : 'border-border/40 bg-background/40 hover:border-border/80 hover:bg-background/70'
                    )}
                  >
                    <div className="text-muted-foreground/50 hover:text-muted-foreground transition-colors">
                      <GripVertical className="h-5 w-5" />
                    </div>

                    <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 text-primary shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground text-sm truncate">{f.name}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {formatSize(f.size)} · {f.pages || '?'} 页
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveFile(index, -1)}
                        disabled={index === 0}
                        aria-label="上移"
                      >
                        ↑
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => moveFile(index, 1)}
                        disabled={index === files.length - 1}
                        aria-label="下移"
                      >
                        ↓
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => removeFile(f.id)}
                        aria-label="删除"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 操作区 */}
      {files.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="flex flex-col sm:flex-row items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Input
                type="text"
                value={resultName}
                onChange={(e) => setResultName(e.target.value)}
                placeholder="合并结果.pdf"
                className="h-11 bg-white/60 dark:bg-slate-900/40 border-border/50 focus:border-primary/50 backdrop-blur-sm"
              />
            </div>
          </div>

          <Button
            onClick={handleMerge}
            disabled={isProcessing}
            size="lg"
            className="w-full sm:w-auto gap-2 bg-gradient-to-r from-primary via-purple-500 to-cyan-500 hover:from-primary/90 hover:via-purple-500/90 hover:to-cyan-500/90 shadow-lg shadow-primary/25"
          >
            {isProcessing ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                合并中 {progress}%
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                开始合并
              </>
            )}
          </Button>
        </motion.div>
      )}

      {/* 进度条 */}
      {isProcessing && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="overflow-hidden"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl dark:bg-slate-900/50 dark:border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">正在合并 PDF 文件...</span>
                <span className="font-medium text-primary">{progress}%</span>
              </div>
              <div className="h-2 rounded-full bg-muted/60 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-gradient-to-r from-primary via-purple-500 to-cyan-500 rounded-full relative"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
                </motion.div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* 下载结果 */}
      <AnimatePresence>
        {resultUrl && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-primary/5 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                      <Check className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-semibold text-foreground">合并完成</div>
                      <div className="text-sm text-muted-foreground">
                        {files.length} 个文件已合并为 {resultName}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={clearAll}
                      className="gap-2"
                    >
                      <RefreshCw className="h-4 w-4" />
                      重新合并
                    </Button>
                    <Button
                      onClick={handleDownload}
                      className="gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-500/90 hover:to-teal-500/90 shadow-md shadow-emerald-500/20"
                    >
                      <Download className="h-4 w-4" />
                      下载文件
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 试用版提示 */}
      {isTrial && files.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版</div>
            <div className="text-xs text-muted-foreground">
              试用版最多合并 {trialLimits.pdfMaxPages} 页 / {trialLimits.pdfMaxFiles} 个文件，导出文件含试用水印。激活后解锁全部功能。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
