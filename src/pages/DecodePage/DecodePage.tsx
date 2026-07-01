import { useState, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ScanLine,
  Upload,
  Image as ImageIcon,
  Copy,
  Download,
  Trash2,
  CheckCircle2,
  XCircle,
  FileText,
  X,
  FileDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { useLicense } from '@/contexts/LicenseContext';
import { decodeQrFromFile, type QrDecodeResult } from '@/utils/qr-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

interface IDecodeItem {
  id: string;
  file: File;
  name: string;
  size: number;
  previewUrl: string;
  result?: QrDecodeResult;
  isProcessing: boolean;
}

export default function DecodePage() {
  const { isTrial, trialLimits } = useLicense();
  const [items, setItems] = useState<IDecodeItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxFiles = isTrial ? trialLimits.maxDecodeImages : 100;

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files).filter((f) => f.type.startsWith('image/'));
      if (fileArray.length === 0) {
        toast.error('请选择图片文件');
        return;
      }

      if (items.length + fileArray.length > maxFiles) {
        toast.error(
          isTrial
            ? `试用版最多识别 ${maxFiles} 张图片，请激活后使用完整功能`
            : `最多支持 ${maxFiles} 张图片`
        );
        return;
      }

      const newItems: IDecodeItem[] = fileArray.map((file) => ({
        id: `${file.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        name: file.name,
        size: file.size,
        previewUrl: URL.createObjectURL(file),
        isProcessing: false,
      }));

      setItems((prev) => [...prev, ...newItems]);
    },
    [items.length, maxFiles, isTrial]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
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
      if (e.target.files) {
        handleFiles(e.target.files);
        e.target.value = '';
      }
    },
    [handleFiles]
  );

  const handleRemove = useCallback((id: string) => {
    setItems((prev) => {
      const target = prev.find((i) => i.id === id);
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  const handleClearAll = useCallback(() => {
    items.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setItems([]);
  }, [items]);

  const handleDecode = useCallback(async () => {
    if (items.length === 0) {
      toast.error('请先上传图片');
      return;
    }

    setIsProcessing(true);
    setItems((prev) => prev.map((item) => ({ ...item, isProcessing: true, result: undefined })));

    try {
      const results: QrDecodeResult[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const result = await decodeQrFromFile(item.file);
          result.fileName = item.name;
          results.push(result);
          setItems((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], result, isProcessing: false };
            return updated;
          });
        } catch (error) {
          logger.error(`Decode failed for ${item.name}:`, String(error));
          const failResult: QrDecodeResult = {
            text: '',
            success: false,
            error: '识别失败',
            fileName: item.name,
          };
          results.push(failResult);
          setItems((prev) => {
            const updated = [...prev];
            updated[i] = { ...updated[i], result: failResult, isProcessing: false };
            return updated;
          });
        }
      }

      const successCount = results.filter((r) => r.success).length;
      toast.success(`识别完成：成功 ${successCount} 张，失败 ${results.length - successCount} 张`);
    } catch (error) {
      toast.error('识别过程出错');
      logger.error('Batch decode failed:', String(error));
    } finally {
      setIsProcessing(false);
    }
  }, [items]);

  const handleCopy = useCallback((text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success('已复制到剪贴板'))
      .catch(() => toast.error('复制失败'));
  }, []);

  const handleExportTxt = useCallback(() => {
    const successItems = items.filter((i) => i.result?.success);
    if (successItems.length === 0) {
      toast.error('没有可导出的识别结果');
      return;
    }

    const content = successItems
      .map((item, idx) => `=== 第 ${idx + 1} 张：${item.name} ===\n${item.result?.text || ''}`)
      .join('\n\n');

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `二维码识别结果_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('已导出 TXT 文件');
  }, [items]);

  const successCount = useMemo(
    () => items.filter((i) => i.result?.success).length,
    [items]
  );

  const hasResults = items.some((i) => i.result);

  return (
    <div className="space-y-6">
      {/* 页面标题 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScanLine className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              二维码识别
            </h1>
            <p className="text-sm text-muted-foreground">
              上传图片，快速识别其中的二维码内容
            </p>
          </div>
        </div>
      </div>

      {/* 上传区域 */}
      <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
        <CardContent className="p-6">
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-all duration-300',
              isDragging
                ? 'border-primary bg-primary/10 scale-[1.01]'
                : 'border-border/60 bg-background/30 hover:border-primary/50 hover:bg-primary/5'
            )}
          >
            <motion.div
              animate={isDragging ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary"
            >
              <Upload className="h-8 w-8" />
            </motion.div>
            <p className="text-base font-medium text-foreground">
              拖拽图片到此处，或点击选择文件
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              支持 PNG、JPG、WebP 等常见图片格式，可批量上传
              {isTrial && (
                <span className="ml-1 text-amber-500">（试用版最多 {maxFiles} 张）</span>
              )}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* 已上传图片列表 */}
      <AnimatePresence>
        {items.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
            className="space-y-4"
          >
            <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
              <CardHeader className="flex flex-row items-center justify-between pb-4">
                <div>
                  <CardTitle className="text-lg">
                    图片列表
                    <Badge variant="outline" className="ml-2">
                      {items.length} 张
                    </Badge>
                    {hasResults && (
                      <Badge
                        variant="outline"
                        className="ml-2 border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                      >
                        成功 {successCount}
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>点击开始识别按钮识别二维码内容</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleClearAll}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    清空
                  </Button>
                  <Button onClick={handleDecode} disabled={isProcessing}>
                    <ScanLine className="mr-2 h-4 w-4" />
                    {isProcessing ? '识别中...' : '开始识别'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  {items.map((item, index) => (
                    <motion.div
                      key={item.id}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: index * 0.03 }}
                      className="group relative overflow-hidden rounded-xl border border-border/40 bg-card/50 backdrop-blur-sm"
                    >
                      <div className="flex gap-3 p-3">
                        {/* 缩略图 */}
                        <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <Image
                            src={item.previewUrl}
                            alt={item.name}
                            className="h-full w-full object-cover"
                          />
                          {item.isProcessing && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                            </div>
                          )}
                        </div>

                        {/* 信息区 */}
                        <div className="flex min-w-0 flex-1 flex-col">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-medium text-foreground">
                              {item.name}
                            </p>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="!absolute right-2 top-2 h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                              onClick={() => handleRemove(item.id)}
                              aria-label="删除"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {(item.size / 1024).toFixed(1)} KB
                          </p>

                          {/* 识别结果 */}
                          {item.result && (
                            <div className="mt-2 flex-1 overflow-hidden">
                              {item.result.success ? (
                                <div className="flex h-full flex-col">
                                  <div className="flex items-center gap-1.5 text-xs text-emerald-500">
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    <span>识别成功</span>
                                  </div>
                                  <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                                    {item.result.text}
                                  </p>
                                  <div className="mt-auto flex gap-1.5 pt-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 px-2 text-xs"
                                      onClick={() => handleCopy(item.result!.text)}
                                    >
                                      <Copy className="mr-1 h-3 w-3" />
                                      复制
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-1.5 text-xs text-destructive">
                                  <XCircle className="h-3.5 w-3.5" />
                                  <span>{item.result.error || '未识别到二维码'}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 导出按钮 */}
            {hasResults && successCount > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex justify-end"
              >
                <Button
                  variant="outline"
                  onClick={handleExportTxt}
                  className="gap-2"
                >
                  <FileDown className="h-4 w-4" />
                  导出 TXT
                </Button>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 空状态提示 */}
      {items.length === 0 && (
        <div className="py-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
            <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">
            上传图片后即可开始识别二维码
          </p>
        </div>
      )}
    </div>
  );
}
