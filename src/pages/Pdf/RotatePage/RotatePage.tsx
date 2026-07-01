import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RotateCw,
  Upload,
  FileText,
  Download,
  RefreshCw,
  X,
  ChevronRight,
  AlertTriangle,
  Check,
  FileWarning,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { rotatePdf, loadPdf } from '@/utils/pdf-lib';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PdfFileInfo {
  file: File;
  name: string;
  size: number;
  pages: number;
  loaded: boolean;
}

type RotateMode = 'all' | 'range' | 'odd' | 'even';
type RotateAngle = 90 | 180 | 270;

export default function RotatePage() {
  const { isTrial, trialLimits } = useLicense();
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [rotateMode, setRotateMode] = useState<RotateMode>('all');
  const [rangeInput, setRangeInput] = useState('');
  const [rotateAngle, setRotateAngle] = useState<RotateAngle>(90);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 格式化文件大小 */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /** 处理文件上传 */
  const handleFile = useCallback(async (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('请上传 PDF 格式文件');
      return;
    }

    setPdfInfo({
      file,
      name: file.name,
      size: file.size,
      pages: 0,
      loaded: false,
    });
    setResultBlob(null);
    setProgress(0);

    try {
      const { pageCount } = await loadPdf(file);
      setPdfInfo({
        file,
        name: file.name,
        size: file.size,
        pages: pageCount,
        loaded: true,
      });
    } catch (err) {
      toast.error(`读取 PDF 失败：${String(err?.message || err)}`);
      setPdfInfo(null);
    }
  }, []);

  /** 拖拽事件 */
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  }, [handleFile]);

  /** 选择文件 */
  const handleSelectFile = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
    e.target.value = '';
  };

  /** 移除文件 */
  const handleRemoveFile = () => {
    setPdfInfo(null);
    setResultBlob(null);
    setProgress(0);
    setRangeInput('');
  };

  /** 解析页码范围 */
  const parsePageRange = (input: string, totalPages: number): number[] => {
    const pages = new Set<number>();
    const parts = input.split(/[,，]/);

    for (const part of parts) {
      const trimmed = part.trim();
      if (!trimmed) continue;

      if (trimmed.includes('-')) {
        const [startStr, endStr] = trimmed.split('-');
        const start = parseInt(startStr.trim(), 10);
        const end = parseInt(endStr.trim(), 10);
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.max(1, Math.min(start, end));
          const e = Math.min(totalPages, Math.max(start, end));
          for (let i = s; i <= e; i++) {
            pages.add(i);
          }
        }
      } else {
        const num = parseInt(trimmed, 10);
        if (!isNaN(num) && num >= 1 && num <= totalPages) {
          pages.add(num);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  };

  /** 获取需要旋转的页码 */
  const getPagesToRotate = (totalPages: number): number[] => {
    switch (rotateMode) {
      case 'all':
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      case 'odd':
        return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 1);
      case 'even':
        return Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0);
      case 'range':
        return parsePageRange(rangeInput, totalPages);
      default:
        return [];
    }
  };

  /** 旋转处理（pdf.js + jsPDF 真实实现） */
  const handleRotate = async () => {
    if (!pdfInfo) return;

    const totalPages = pdfInfo.pages || 0;
    const pagesToRotate = getPagesToRotate(totalPages);

    if (pagesToRotate.length === 0 && rotateMode !== 'all') {
      toast.error('请选择要旋转的页面');
      return;
    }

    const rotateCount = rotateMode === 'all' ? totalPages : pagesToRotate.length;
    if (isTrial && rotateCount > trialLimits.pdfMaxPages) {
      toast.warning(`试用版最多处理 ${trialLimits.pdfMaxPages} 页，激活后解锁全部功能`);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResultBlob(null);

    try {
      const targetPages: number[] | 'all' = rotateMode === 'all' ? 'all' : pagesToRotate;
      const blob = await rotatePdf(
        pdfInfo.file,
        targetPages,
        rotateAngle,
        (percent) => setProgress(percent),
        isTrial && trialLimits.addWatermark,
      );

      setResultBlob(blob);
      setResultName(pdfInfo.name.replace('.pdf', '_旋转后.pdf'));
      toast.success(`成功旋转 ${rotateCount} 页`);
    } catch (err) {
      toast.error(`旋转失败：${String(err?.message || err)}`);
    } finally {
      setIsProcessing(false);
    }
  };

  /** 下载结果 */
  const handleDownload = () => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('文件已开始下载');
  };

  const angles: { value: RotateAngle; label: string; icon: string }[] = [
    { value: 90, label: '90° 顺时针', icon: '↻' },
    { value: 180, label: '180°', icon: '⟳' },
    { value: 270, label: '270° 逆时针', icon: '↺' },
  ];

  const totalPages = pdfInfo?.pages || 0;
  const pagesToRotateCount = pdfInfo ? getPagesToRotate(totalPages || 10).length : 0;

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
              <RotateCw className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">PDF 旋转</h1>
            <p className="text-sm text-muted-foreground">
              支持全部、指定范围、奇偶页选择，90°/180°/270° 旋转
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 最多 {trialLimits.pdfMaxPages} 页
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：上传区 + 文件信息 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-3 space-y-4"
        >
          {/* 上传区 */}
          {!pdfInfo ? (
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardContent className="p-0">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={handleSelectFile}
                  className={cn(
                    'relative cursor-pointer rounded-xl p-12 text-center transition-all duration-300',
                    'border-2 border-dashed',
                    isDragging
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-border/50 hover:border-primary/50 hover:bg-primary/5'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <div className="flex flex-col items-center gap-4">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl" />
                      <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary">
                        <Upload className="h-8 w-8" />
                      </div>
                    </div>
                    <div>
                      <p className="text-base font-medium text-foreground">
                        拖拽 PDF 文件到此处，或点击选择
                      </p>
                      <p className="text-sm text-muted-foreground mt-1">
                        支持单个 PDF 文件，最大 100MB
                      </p>
                    </div>
                    <Button
                      type="button"
                      className="mt-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      选择 PDF 文件
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center">
                    <FileText className="h-7 w-7 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="font-medium text-foreground truncate">{pdfInfo.name}</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {formatSize(pdfInfo.size)}
                          {pdfInfo.pages > 0 && ` · ${pdfInfo.pages} 页`}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleRemoveFile}
                        className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive shrink-0"
                        aria-label="移除"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* 处理进度 */}
                    {isProcessing && (
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>正在旋转处理...</span>
                          <span>{progress}%</span>
                        </div>
                        <Progress value={progress} className="h-2" />
                      </div>
                    )}

                    {/* 处理完成 */}
                    {resultBlob && !isProcessing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mt-4 flex items-center gap-2 text-sm text-success bg-success/10 rounded-lg px-3 py-2"
                      >
                        <Check className="h-4 w-4 shrink-0" />
                        <span>处理完成，共旋转 {pagesToRotateCount} 页</span>
                      </motion.div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 处理结果下载 */}
          <AnimatePresence>
            {resultBlob && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <Card className="border border-success/30 bg-success/5 backdrop-blur-xl shadow-md dark:bg-success/10">
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-success/20 text-success">
                          <Check className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">处理完成</h3>
                          <p className="text-sm text-muted-foreground">
                            文件名：{resultName}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={handleRemoveFile}
                          className="gap-2"
                        >
                          <RefreshCw className="h-4 w-4" />
                          重新处理
                        </Button>
                        <Button
                          onClick={handleDownload}
                          className="gap-2 bg-gradient-to-r from-success to-emerald-600 hover:from-success/90 hover:to-emerald-600/90 shadow-md shadow-success/20"
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
        </motion.div>

        {/* 右侧：旋转参数设置 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-2 space-y-4"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <RotateCw className="h-5 w-5 text-primary" />
                旋转设置
              </CardTitle>
              <CardDescription className="text-xs">
                选择要旋转的页面范围和旋转角度
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 旋转角度 */}
              <div className="space-y-2.5">
                <Label className="text-sm font-medium">旋转角度</Label>
                <div className="grid grid-cols-3 gap-2">
                  {angles.map((angle) => (
                    <button
                      key={angle.value}
                      onClick={() => setRotateAngle(angle.value)}
                      disabled={!pdfInfo || isProcessing}
                      className={cn(
                        'flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all duration-200',
                        rotateAngle === angle.value
                          ? 'border-primary bg-primary/10 text-primary shadow-sm shadow-primary/10'
                          : 'border-border/50 bg-background/30 text-muted-foreground hover:border-primary/40 hover:text-foreground',
                        (!pdfInfo || isProcessing) && 'opacity-50 cursor-not-allowed'
                      )}
                    >
                      <span className="text-xl font-bold">{angle.icon}</span>
                      <span className="text-xs font-medium">{angle.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 页面选择方式 */}
              <div className="space-y-2.5">
                <Label className="text-sm font-medium">页面选择</Label>
                <Tabs
                  value={rotateMode}
                  onValueChange={(v) => setRotateMode(v as RotateMode)}
                  className="w-full"
                >
                  <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                    <TabsTrigger value="all" className="text-xs">
                      全部
                    </TabsTrigger>
                    <TabsTrigger value="range" className="text-xs">
                      指定范围
                    </TabsTrigger>
                    <TabsTrigger value="odd" className="text-xs">
                      奇数页
                    </TabsTrigger>
                    <TabsTrigger value="even" className="text-xs">
                      偶数页
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 范围输入 */}
              {rotateMode === 'range' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="space-y-2"
                >
                  <Label htmlFor="range" className="text-sm font-medium">
                    页码范围
                  </Label>
                  <Input
                    id="range"
                    type="text"
                    value={rangeInput}
                    onChange={(e) => setRangeInput(e.target.value)}
                    placeholder="如：1-5, 8, 10-12"
                    disabled={!pdfInfo || isProcessing}
                    className="bg-background/50 border-border/50 focus:border-primary/50"
                  />
                  <p className="text-xs text-muted-foreground">
                    用逗号分隔多个范围，如 1-5, 8, 10-12
                  </p>
                </motion.div>
              )}

              {/* 预览信息 */}
              {pdfInfo && (
                <div className="rounded-xl border border-border/40 bg-muted/30 p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">总页数</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {totalPages || '读取中...'} 页
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">将旋转</span>
                    <span className="font-medium text-primary tabular-nums">
                      {pagesToRotateCount} 页
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">旋转角度</span>
                    <span className="font-medium text-foreground tabular-nums">
                      {rotateAngle}°
                    </span>
                  </div>
                </div>
              )}

              {/* 试用版提示 */}
              {isTrial && pdfInfo && (
                <div className="rounded-xl border border-warning/30 bg-warning/10 p-3 flex items-start gap-2.5">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-warning mb-0.5">试用版限制</p>
                    <p>最多处理 {trialLimits.pdfMaxPages} 页，导出文件含试用水印。</p>
                  </div>
                </div>
              )}

              {/* 开始旋转按钮 */}
              <Button
                onClick={handleRotate}
                disabled={!pdfInfo || isProcessing}
                className="w-full h-11 text-base font-medium bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    处理中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <RotateCw className="h-4 w-4" />
                    开始旋转
                    <ChevronRight className="h-4 w-4" />
                  </span>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* 使用说明 */}
          <Card className="border border-white/20 bg-white/40 backdrop-blur-xl shadow-md dark:bg-slate-900/40 dark:border-white/10">
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                <FileWarning className="h-4 w-4 text-primary" />
                使用说明
              </h4>
              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>上传 PDF 文件，选择旋转角度和页面范围</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>支持全部页面、指定页码、奇数页、偶数页四种方式</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>所有操作在浏览器本地完成，文件不上传服务器</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
