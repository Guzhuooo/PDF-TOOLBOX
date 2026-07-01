import { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Unlock,
  Upload,
  FileText,
  X,
  Eye,
  EyeOff,
  Download,
  AlertTriangle,
  Check,
  Lock,
  Loader2,
  FileWarning,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { decryptPdf, isPdfEncrypted, loadPdf } from '@/utils/pdf-lib';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PdfFileInfo {
  file: File;
  name: string;
  size: number;
  pages: number;
  isEncrypted: boolean;
}

export default function DecryptPage() {
  const { isTrial, trialLimits } = useLicense();
  const [pdfInfo, setPdfInfo] = useState<PdfFileInfo | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordVerified, setPasswordVerified] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 格式化文件大小 */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  /** 处理文件选择 */
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('请选择 PDF 文件');
      return;
    }

    setPdfInfo(null);
    setPassword('');
    setPasswordVerified(false);
    setPasswordError('');
    setResultBlob(null);
    setProgress(0);

    try {
      const encrypted = await isPdfEncrypted(file);
      let pageCount = 0;

      if (!encrypted) {
        // 未加密的PDF直接读取页数
        const info = await loadPdf(file);
        pageCount = info.pageCount;
      }

      const info: PdfFileInfo = {
        file,
        name: file.name,
        size: file.size,
        pages: pageCount,
        isEncrypted: encrypted,
      };

      // 试用版页数限制（未加密的PDF才检查页数）
      if (isTrial && !encrypted && pageCount > trialLimits.pdfMaxPages) {
        toast.warning(`试用版最多处理 ${trialLimits.pdfMaxPages} 页，当前文件 ${pageCount} 页。激活后解锁全部页数。`);
      }

      setPdfInfo(info);
      if (encrypted) {
        toast.success('文件已加载，检测到加密保护');
      } else {
        toast.info('文件未加密，可直接下载原文件');
      }
    } catch (err) {
      // 密码错误或文件损坏
      const msg = String(err?.message || err);
      if (msg.toLowerCase().includes('password')) {
        // 加密PDF（pdf.js在无密码时会抛错）
        const info: PdfFileInfo = {
          file,
          name: file.name,
          size: file.size,
          pages: 0,
          isEncrypted: true,
        };
        setPdfInfo(info);
        toast.success('文件已加载，检测到加密保护');
      } else {
        toast.error('文件读取失败，请检查文件是否损坏');
      }
    }
  }, [isTrial, trialLimits]);

  /** 拖拽处理 */
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
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  /** 验证密码 */
  const handleVerifyPassword = useCallback(async () => {
    if (!password.trim()) {
      setPasswordError('请输入密码');
      return;
    }
    if (!pdfInfo) return;

    setPasswordError('');
    setIsProcessing(true);
    setProgress(20);

    try {
      // 尝试用密码加载PDF来验证
      const { pageCount } = await loadPdf(pdfInfo.file, password);
      setPasswordVerified(true);
      setProgress(100);
      // 更新页数信息
      setPdfInfo((prev) => (prev ? { ...prev, pages: pageCount } : prev));
      toast.success('密码验证成功，可以解密');
    } catch (err) {
      const msg = String(err?.message || err);
      if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('incorrect')) {
        setPasswordError('密码错误，请重试');
      } else {
        setPasswordError('验证失败，请检查密码');
      }
      setProgress(0);
    } finally {
      setIsProcessing(false);
    }
  }, [password, pdfInfo]);

  /** 执行解密 */
  const handleDecrypt = useCallback(async () => {
    if (!pdfInfo || !passwordVerified) return;

    // 试用版限制检查
    if (isTrial && pdfInfo.pages > trialLimits.pdfMaxPages) {
      toast.warning(`试用版最多处理 ${trialLimits.pdfMaxPages} 页，请激活后使用完整功能`);
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setResultBlob(null);

    try {
      const blob = await decryptPdf(
        pdfInfo.file,
        password,
        (percent) => setProgress(percent),
        isTrial && trialLimits.addWatermark,
      );
      setResultBlob(blob);
      toast.success('解密完成！');
    } catch (err) {
      toast.error(`解密失败：${String(err?.message || err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pdfInfo, passwordVerified, password, isTrial, trialLimits]);

  /** 下载结果 */
  const handleDownload = useCallback(() => {
    if (!resultBlob || !pdfInfo) return;

    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    const baseName = pdfInfo.name.replace(/\.pdf$/i, '');
    a.download = `${baseName}_解密.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('已开始下载');
  }, [resultBlob, pdfInfo]);

  /** 移除文件 */
  const handleRemove = useCallback(() => {
    setPdfInfo(null);
    setPassword('');
    setPasswordVerified(false);
    setPasswordError('');
    setResultBlob(null);
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /** 获取输出文件名 */
  const getOutputName = (): string => {
    if (!pdfInfo) return '';
    return pdfInfo.name.replace(/\.pdf$/i, '') + '_解密.pdf';
  };

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
              <Unlock className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">PDF解密</h1>
            <p className="text-sm text-muted-foreground">
              上传加密PDF，输入密码后解密下载
            </p>
          </div>
        </div>

        {isTrial && (
          <Badge variant="secondary" className="w-fit text-xs">
            试用版 · 最多 {trialLimits.pdfMaxPages} 页
          </Badge>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：上传 + 密码 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-3 space-y-4"
        >
          {/* 上传区域 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Upload className="h-5 w-5 text-primary" />
                上传PDF文件
              </CardTitle>
              <CardDescription className="text-xs">
                支持拖拽上传，仅接受 PDF 格式文件
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!pdfInfo ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'relative flex flex-col items-center justify-center py-16 px-6 rounded-xl border-2 border-dashed cursor-pointer transition-all duration-300',
                    isDragging
                      ? 'border-primary bg-primary/10 scale-[1.01]'
                      : 'border-border/60 hover:border-primary/50 hover:bg-primary/5'
                  )}
                >
                  <div className="relative mb-4">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg" />
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-primary/10">
                      <Upload className="h-8 w-8 text-primary" />
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mb-1">
                    点击或拖拽文件到此处
                  </p>
                  <p className="text-sm text-muted-foreground">
                    支持 PDF 格式，单文件不超过 100MB
                  </p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 文件信息 */}
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-primary/10 shrink-0">
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-foreground truncate">{pdfInfo.name}</div>
                      <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>{formatSize(pdfInfo.size)}</span>
                        <span>·</span>
                        <span>{pdfInfo.pages} 页</span>
                        {pdfInfo.isEncrypted && (
                          <>
                            <span>·</span>
                            <Badge variant="outline" className="text-xs border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                              <Lock className="h-3 w-3 mr-1" />
                              已加密
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemove}
                      className="h-9 w-9 rounded-full hover:bg-destructive/10 hover:text-destructive shrink-0"
                      aria-label="移除文件"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* 密码输入 */}
                  {!passwordVerified && (
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium">
                          打开密码
                        </Label>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input
                            id="password"
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setPasswordError('');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleVerifyPassword();
                              }
                            }}
                            placeholder="请输入PDF打开密码"
                            className="pl-10 pr-20 h-11 bg-background/50 border-border/50"
                          />
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setShowPassword(!showPassword)}
                              aria-label={showPassword ? '隐藏密码' : '显示密码'}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>
                        {passwordError && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{passwordError}</span>
                          </div>
                        )}
                        <p className="text-xs text-muted-foreground">
                          提示：演示密码为 <code className="px-1.5 py-0.5 rounded bg-muted text-foreground">123456</code>
                        </p>
                      </div>

                      <Button
                        onClick={handleVerifyPassword}
                        disabled={isProcessing || !password.trim()}
                        className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
                      >
                        {isProcessing ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            验证中...
                          </>
                        ) : (
                          <>
                            <Unlock className="h-4 w-4 mr-2" />
                            验证密码
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* 密码验证成功 */}
                  {passwordVerified && (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/30 text-success">
                        <Check className="h-5 w-5 shrink-0" />
                        <span className="text-sm font-medium">密码验证成功，文件可以解密</span>
                      </div>

                      {progress > 0 && progress < 100 && (
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>解密进度</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      )}

                      {!resultBlob && (
                        <Button
                          onClick={handleDecrypt}
                          disabled={isProcessing}
                          className="w-full bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              解密中...
                            </>
                          ) : (
                            <>
                              <Unlock className="h-4 w-4 mr-2" />
                              开始解密
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：结果 + 说明 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* 解密结果 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                解密结果
              </CardTitle>
            </CardHeader>
            <CardContent>
              {resultBlob ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-success/10 border border-success/30">
                    <div className="flex items-center gap-2 text-success font-medium mb-2">
                      <Check className="h-5 w-5" />
                      解密成功
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>文件名：{getOutputName()}</p>
                      <p>文件大小：{formatSize(resultBlob.size)}</p>
                      {isTrial && (
                        <p className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          试用版导出含水印
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleDownload}
                    className="w-full bg-gradient-to-r from-success to-emerald-600 hover:from-success/90 hover:to-emerald-600/90 shadow-md shadow-success/20"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    下载解密文件
                  </Button>
                </div>
              ) : (
                <div className="py-8 text-center">
                  <div className="flex items-center justify-center w-16 h-16 mx-auto mb-3 rounded-full bg-muted/50">
                    <FileWarning className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    上传加密PDF并验证密码后，解密结果将显示在这里
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 使用说明 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">使用说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5">1</div>
                <span>上传受密码保护的 PDF 文件</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5">2</div>
                <span>输入正确的打开密码并验证</span>
              </div>
              <div className="flex items-start gap-2">
                <div className="flex items-center justify-center w-5 h-5 rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 mt-0.5">3</div>
                <span>点击解密，处理完成后下载无密码 PDF</span>
              </div>
              <div className="pt-2 mt-2 border-t border-border/30 text-xs">
                <p className="text-muted-foreground/70">
                  💡 所有操作均在您的浏览器本地完成，文件不会上传到任何服务器
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
