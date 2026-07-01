import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  KeyRound,
  X,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  Eye,
  EyeOff,
  FileText,
  Image,
  QrCode,
  Type,
  Calculator,
  CheckCircle2,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useLicense } from '@/contexts/LicenseContext';

interface ActivationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showTrialButton?: boolean;
}

export default function ActivationDialog({
  open,
  onOpenChange,
  showTrialButton = true,
}: ActivationDialogProps) {
  const { activate } = useLicense();
  const [code, setCode] = useState('');
  const [showCode, setShowCode] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open) {
      setCode('');
      setError('');
      setShowCode(false);
    }
  }, [open]);

  const handleActivate = async () => {
    setError('');
    const trimmed = code.trim().toUpperCase();

    if (!trimmed) {
      setError('请输入激活码');
      return;
    }

    setIsActivating(true);
    await new Promise((r) => setTimeout(r, 800));

    const result = activate(trimmed);
    if (!result.success) {
      setError(result.message || '激活码无效');
      setIsActivating(false);
      return;
    }
    toast.success('激活成功！已解锁全部功能');
    setIsActivating(false);
    onOpenChange(false);
  };

  const handleTrial = () => {
    onOpenChange(false);
    toast.info('您正在使用试用版，各模块有使用限制');
  };

  const trialFeatures = [
    { icon: FileText, label: 'PDF 最多 3 页' },
    { icon: Image, label: '图片最多 5 张' },
    { icon: QrCode, label: '二维码批量 5 个' },
    { icon: Type, label: '文本最多 5000 字' },
    { icon: Calculator, label: '单位换算仅 3 类' },
  ];

  const proFeatures = [
    { icon: FileText, label: 'PDF 无限页数' },
    { icon: Image, label: '图片批量无限' },
    { icon: QrCode, label: '二维码批量无限' },
    { icon: Type, label: '文本无字数限制' },
    { icon: Calculator, label: '全部 8 类换算' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] border-0 p-0 bg-transparent shadow-none">
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative overflow-hidden rounded-2xl border border-white/20 bg-white/70 backdrop-blur-2xl shadow-2xl dark:bg-slate-900/70 dark:border-white/10"
            >
              {/* 装饰性渐变光晕 */}
              <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 rounded-full bg-purple-500/20 blur-3xl pointer-events-none" />

              {/* 关闭按钮 */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute right-4 top-4 z-10 rounded-full p-1.5 text-muted-foreground hover:bg-foreground/10 hover:text-foreground transition-colors"
                aria-label="关闭"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="relative p-8">
                {/* 图标 */}
                <div className="flex justify-center mb-6">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-primary/30 blur-xl" />
                    <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-purple-600 text-white shadow-lg">
                      <ShieldCheck className="h-8 w-8" />
                    </div>
                  </div>
                </div>

                <DialogHeader className="text-center mb-6">
                  <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    激活全能办公工具
                  </DialogTitle>
                  <DialogDescription className="text-muted-foreground mt-2">
                    输入激活码解锁全部 5 大工具模块，享受无限制的办公体验
                  </DialogDescription>
                </DialogHeader>

                {/* 激活码输入 */}
                <div className="space-y-4 mb-6">
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      <KeyRound className="h-4 w-4" />
                    </div>
                    <Input
                      type={showCode ? 'text' : 'password'}
                      value={code}
                      onChange={(e) => {
                        setCode(e.target.value);
                        setError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleActivate();
                        }
                      }}
                      placeholder="请输入激活码，格式：OFFICE-XXXXXXXX"
                      className="pl-10 pr-10 h-12 bg-white/80 dark:bg-slate-800/80 border-border/60 focus:border-primary/60 focus:ring-2 focus:ring-primary/20 transition-all"
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode(!showCode)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showCode ? '隐藏激活码' : '显示激活码'}
                    >
                      {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2"
                    >
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      <span>{error}</span>
                    </motion.div>
                  )}

                  {/* 功能对比 */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="rounded-xl border border-border/50 bg-white/50 dark:bg-slate-800/50 p-3">
                      <div className="text-xs text-muted-foreground mb-3">试用版</div>
                      <div className="space-y-2">
                        {trialFeatures.map((f) => {
                          const Icon = f.icon;
                          return (
                            <div key={f.label} className="flex items-center gap-2 text-sm">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="text-muted-foreground">{f.label}</span>
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-2 text-sm">
                          <AlertCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground">导出带水印</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-xl border border-primary/30 bg-primary/10 p-3">
                      <div className="text-xs text-primary font-medium mb-3 flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        正式版
                      </div>
                      <div className="space-y-2">
                        {proFeatures.map((f) => {
                          const Icon = f.icon;
                          return (
                            <div key={f.label} className="flex items-center gap-2 text-sm">
                              <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="text-foreground">{f.label}</span>
                              <CheckCircle2 className="h-3 w-3 text-success ml-auto shrink-0" />
                            </div>
                          );
                        })}
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-foreground">无水印导出</span>
                          <CheckCircle2 className="h-3 w-3 text-success ml-auto shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 按钮组 */}
                <div className="space-y-3">
                  <Button
                    onClick={handleActivate}
                    disabled={isActivating}
                    className="w-full h-12 text-base font-medium bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-lg shadow-primary/25 transition-all hover:shadow-xl hover:shadow-primary/30"
                  >
                    {isActivating ? (
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
                        激活中...
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" />
                        立即激活
                      </span>
                    )}
                  </Button>

                  {showTrialButton && (
                    <Button
                      variant="ghost"
                      onClick={handleTrial}
                      className="w-full h-10 text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                    >
                      继续试用
                    </Button>
                  )}
                </div>

                {/* 底部隐私提示 */}
                <p className="text-xs text-muted-foreground/70 text-center mt-6">
                  激活信息仅保存在本地浏览器中，保护您的隐私
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
