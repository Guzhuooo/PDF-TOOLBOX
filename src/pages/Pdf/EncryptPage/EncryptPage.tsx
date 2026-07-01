import { useState, useCallback, useMemo, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Lock,
  Upload,
  FileText,
  X,
  Download,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertTriangle,
  RefreshCw,
  Check,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import { encryptPdf, loadPdf } from '@/utils/pdf-lib';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

interface PdfFile {
  id: string;
  file: File;
  name: string;
  size: number;
  pageCount: number;
}

export default function EncryptPage() {
  const { isTrial, trialLimits } = useLicense();
  const [pdfFile, setPdfFile] = useState<PdfFile | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultName, setResultName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /** 计算密码强度 */
  const passwordStrength = useCallback((pwd: string): { level: number; label: string; color: string } => {
    if (!pwd) return { level: 0, label: '未设置', color: 'bg-muted' };
    let score = 0;
    if (pwd.length >= 6) score++;
    if (pwd.length >= 10) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { level: 1, label: '弱', color: 'bg-destructive' };
    if (score <= 3) return { level: 2, label: '中', color: 'bg-warning' };
    return { level: 3, label: '强', color: 'bg-success' };
  }, []);

  const strength = passwordStrength(password);

  /** 处理文件选择 */
  const handleFileSelect = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('请上传 PDF 文件');
      return;
    }

    if (isTrial) {
      // 试用版提示
      toast.info('试用版最多加密 3 页，激活后解锁无限页数');
    }

    setPdfFile({
      id: Math.random().toString(36).slice(2),
      file,
      name: file.name,
      size: file.size,
      pageCount: 0,
    });
    setResultBlob(null);
    setResultName('');

    try {
      const { pageCount } = await loadPdf(file);
      setPdfFile((prev) => (prev ? { ...prev, pageCount } : prev));
    } catch (err) {
      toast.error(`读取 PDF 失败：${String(err?.message || err)}`);
      setPdfFile(null);
    }
  }, [isTrial]);

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
      handleFileSelect(files[0]);
    }
  }, [handleFileSelect]);

  /** 移除文件 */
  const handleRemoveFile = useCallback(() => {
    setPdfFile(null);
    setResultBlob(null);
    setResultName('');
    setPassword('');
    setConfirmPassword('');
  }, []);

  /** 格式化文件大小 */
  const formatSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  /** 加密 PDF（pdf.js + jsPDF 真实实现） */
  const handleEncrypt = useCallback(async () => {
    if (!pdfFile) {
      toast.error('请先上传 PDF 文件');
      return;
    }
    if (!password) {
      toast.error('请设置打开密码');
      return;
    }
    if (password.length < 4) {
      toast.error('密码长度至少 4 位');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('两次输入的密码不一致');
      return;
    }

    if (isTrial && pdfFile.pageCount > trialLimits.pdfMaxPages) {
      toast.warning(`试用版最多加密 ${trialLimits.pdfMaxPages} 页，激活后解锁无限制`);
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      const blob = await encryptPdf(
        pdfFile.file,
        password,
        (percent) => setProgress(percent),
        isTrial && trialLimits.addWatermark,
      );

      const newName = pdfFile.name.replace(/\.pdf$/i, '_加密.pdf');
      setResultBlob(blob);
      setResultName(newName);
      setProgress(100);
      toast.success('PDF 加密成功');
    } catch (err) {
      toast.error(`加密失败：${String(err?.message || err)}`);
    } finally {
      setIsProcessing(false);
    }
  }, [pdfFile, password, confirmPassword, isTrial, trialLimits.pdfMaxPages, trialLimits.addWatermark]);

  /** 下载结果 */
  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    const url = URL.createObjectURL(resultBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resultName || 'encrypted.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('已开始下载');
  }, [resultBlob, resultName]);

  /** 重置 */
  const handleReset = useCallback(() => {
    setPdfFile(null);
    setPassword('');
    setConfirmPassword('');
    setResultBlob(null);
    setResultName('');
    setProgress(0);
  }, []);

  const canEncrypt = pdfFile && password && password === confirmPassword && password.length >= 4 && !isProcessing;

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
              <Lock className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">PDF 加密</h1>
            <p className="text-sm text-muted-foreground">
              为 PDF 文件设置打开密码，保护文档安全
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            重置
          </Button>
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 最多 3 页
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
          {!pdfFile && (
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardContent className="p-0">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={cn(
                    'flex flex-col items-center justify-center py-16 px-6 cursor-pointer transition-all duration-300 rounded-xl',
                    isDragging
                      ? 'bg-primary/10 border-2 border-primary/50 scale-[1.01]'
                      : 'hover:bg-muted/30 border-2 border-dashed border-border/50 hover:border-primary/30'
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(file);
                      e.target.value = '';
                    }}
                  />
                  <div className="relative mb-4">
                    <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg" />
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary">
                      <Upload className="h-8 w-8" />
                    </div>
                  </div>
                  <p className="text-base font-medium text-foreground mb-1">
                    点击或拖拽 PDF 文件到此处
                  </p>
                  <p className="text-sm text-muted-foreground">
                    支持单个 PDF 文件，最大 100MB
                  </p>
                  {isTrial && (
                    <p className="text-xs text-warning mt-3 flex items-center gap-1">
                      <AlertTriangle className="h-3.5 w-3.5" />
                      试用版最多加密 3 页，激活后解锁全部功能
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 已上传文件信息 */}
          {pdfFile && (
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  待加密文件
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20 text-primary shrink-0">
                    <FileText className="h-6 w-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground truncate">{pdfFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatSize(pdfFile.size)}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRemoveFile}
                    className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                    aria-label="移除文件"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 处理进度 */}
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">正在加密...</span>
                <span className="font-medium text-primary">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </motion.div>
          )}

          {/* 结果区 */}
          {resultBlob && !isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="border border-success/30 bg-success/5 backdrop-blur-xl shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg font-semibold flex items-center gap-2 text-success">
                    <Check className="h-5 w-5" />
                    加密完成
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-4 p-4 rounded-xl bg-white/50 dark:bg-slate-800/50 border border-border/30">
                    <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-to-br from-success/20 to-emerald-500/20 text-success shrink-0">
                      <ShieldCheck className="h-6 w-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{resultName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatSize(resultBlob.size)}
                      </p>
                    </div>
                    <Button
                      onClick={handleDownload}
                      className="gap-2 bg-gradient-to-r from-success to-emerald-600 hover:from-success/90 hover:to-emerald-600/90 shadow-md shadow-success/20"
                    >
                      <Download className="h-4 w-4" />
                      下载
                    </Button>
                  </div>
                  {isTrial && (
                    <div className="flex items-start gap-2 text-xs text-warning bg-warning/10 rounded-lg p-3">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>试用版导出的 PDF 含试用水印。激活后解锁无水印导出。</span>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </motion.div>

        {/* 右侧：密码设置 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-2"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Lock className="h-5 w-5 text-primary" />
                密码设置
              </CardTitle>
              <CardDescription className="text-xs">
                设置打开密码，保护您的 PDF 文档
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 打开密码 */}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">
                  打开密码
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="请输入打开密码"
                    className="pr-10 bg-background/50 border-border/50 focus:border-primary/50"
                    disabled={!pdfFile || isProcessing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 密码强度 */}
              {password && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">密码强度</span>
                    <span className={cn(
                      'font-medium',
                      strength.level === 1 && 'text-destructive',
                      strength.level === 2 && 'text-warning',
                      strength.level === 3 && 'text-success'
                    )}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden flex gap-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={cn(
                          'flex-1 rounded-full transition-all duration-300',
                          i <= strength.level ? strength.color : 'bg-muted'
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    建议使用 10 位以上，包含大小写字母、数字和特殊字符
                  </p>
                </motion.div>
              )}

              {/* 确认密码 */}
              <div className="space-y-2">
                <Label htmlFor="confirm" className="text-sm font-medium">
                  确认密码
                </Label>
                <div className="relative">
                  <Input
                    id="confirm"
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="请再次输入密码"
                    className={cn(
                      'pr-10 bg-background/50 border-border/50 focus:border-primary/50',
                      confirmPassword && password !== confirmPassword && 'border-destructive/50 focus:border-destructive/50'
                    )}
                    disabled={!pdfFile || isProcessing}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirm ? '隐藏密码' : '显示密码'}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    两次输入的密码不一致
                  </p>
                )}
                {confirmPassword && password === confirmPassword && password.length >= 4 && (
                  <p className="text-xs text-success flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" />
                    密码一致
                  </p>
                )}
              </div>

              {/* 加密提示 */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-primary">
                  <Sparkles className="h-4 w-4" />
                  安全提示
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• 请牢记密码，密码丢失无法恢复</li>
                  <li>• 使用强密码可有效防止暴力破解</li>
                  <li>• 加密后的 PDF 打开时需要输入密码</li>
                </ul>
              </div>

              {/* 加密按钮 */}
              <Button
                onClick={handleEncrypt}
                disabled={!canEncrypt}
                className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
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
                    加密中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    开始加密
                  </span>
                )}
              </Button>

              {isTrial && (
                <p className="text-xs text-center text-muted-foreground">
                  试用版最多加密 3 页 · 激活后解锁无限页数
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
