import { useState, useContext } from 'react';
import { Sun, Moon, Key, X, Check, Wrench, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { LicenseContext } from '@/contexts/LicenseContext';
import { ThemeContext } from '@/contexts/ThemeContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface HeaderProps {
  onMenuClick?: () => void;
}

export default function Header({ onMenuClick }: HeaderProps) {
  const ctx = useContext(LicenseContext);
  const isActivated = ctx?.isActivated ?? false;
  const activate = ctx?.activate ?? (() => ({ success: false, message: '' }));
  const license = ctx?.license ?? null;
  const deactivate = ctx?.deactivate ?? (() => {});
  const themeCtx = useContext(ThemeContext);
  const theme = themeCtx?.theme ?? 'light';
  const toggleTheme = themeCtx?.toggleTheme ?? (() => {});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleActivate = async () => {
    if (!code.trim()) {
      toast.error('请输入激活码');
      return;
    }
    setVerifying(true);
    await new Promise((r) => setTimeout(r, 600));
    const result = activate(code.trim().toUpperCase());
    if (result.success) {
      toast.success('激活成功！已解锁全部功能');
      setDialogOpen(false);
      setCode('');
    } else {
      toast.error(result.message || '激活码无效，请检查后重试');
    }
    setVerifying(false);
  };

  const handleDeactivate = () => {
    deactivate();
    toast.info('已退出激活状态');
    setDialogOpen(false);
  };

  return (
    <header className="sticky top-0 z-40 w-full">
      <div
        className={cn(
          'mx-4 mt-4 flex h-16 items-center justify-between rounded-2xl border px-4 md:mx-6 md:mt-6 md:px-6',
          'border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5',
          'dark:border-white/10 dark:bg-background/30 dark:shadow-black/20'
        )}
      >
        {/* 左侧：菜单按钮 + Logo + 标题 */}
        <div className="flex items-center gap-3">
          {/* 移动端菜单按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="h-9 w-9 rounded-xl bg-white/40 hover:bg-white/70 backdrop-blur-md dark:bg-white/5 dark:hover:bg-white/10 md:hidden"
            aria-label="菜单"
          >
            <Menu className="h-5 w-5 text-foreground" />
          </Button>

          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-purple-500 to-cyan-500 text-primary-foreground shadow-md shadow-primary/30">
            <Wrench className="h-5 w-5" />
          </div>
          <div className="hidden flex-col sm:flex">
            <span className="text-sm font-bold tracking-tight text-foreground">
              全能办公工具
            </span>
            <span className="text-[11px] text-muted-foreground">
              PDF · 图片 · 二维码 · 文本 · 计算
            </span>
          </div>
        </div>

        {/* 右侧：激活状态 + 主题切换 */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* 激活状态标签 */}
          {isActivated ? (
            <Badge
              variant="outline"
              className="gap-1.5 border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-600 dark:text-emerald-400"
            >
              <Check className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">已激活</span>
              <span className="sm:hidden">Pro</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="gap-1.5 border-amber-500/30 bg-amber-500/10 px-3 py-1 text-amber-600 dark:text-amber-400"
            >
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              <span className="hidden sm:inline">试用版</span>
              <span className="sm:hidden">试用</span>
            </Badge>
          )}

          {/* 激活按钮 */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDialogOpen(true)}
            className={cn(
              'gap-1.5 border-primary/30 bg-white/60 text-primary hover:bg-primary/10 backdrop-blur-md',
              'dark:bg-white/5 dark:hover:bg-white/10'
            )}
          >
            <Key className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isActivated ? '管理激活' : '立即激活'}
            </span>
            <span className="sm:hidden">激活</span>
          </Button>

          {/* 主题切换按钮 */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 rounded-full bg-white/40 hover:bg-white/70 backdrop-blur-md dark:bg-white/5 dark:hover:bg-white/10"
            aria-label="切换主题"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-500" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </Button>
        </div>
      </div>

      {/* 激活弹窗 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/5 to-cyan-500/10 opacity-60" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-purple-500 to-cyan-500 text-primary-foreground shadow-md shadow-primary/30">
                <Key className="h-5 w-5" />
              </div>
              <span>激活全能办公工具</span>
            </DialogTitle>
            <DialogDescription className="pt-2">
              输入激活码解锁全部 5 大工具模块，去除数量限制和水印。激活后永久有效。
            </DialogDescription>
          </DialogHeader>

          {isActivated && license ? (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-5 w-5" />
                  <span className="font-semibold">已激活 · 专业版</span>
                </div>
                <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                  <p>激活码：{license.code}</p>
                  <p>
                    激活时间：
                    {new Date(license.activatedAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  variant="outline"
                  onClick={handleDeactivate}
                  className="w-full text-destructive hover:text-destructive"
                >
                  退出激活
                </Button>
                <Button variant="ghost" onClick={() => setDialogOpen(false)} className="w-full">
                  关闭
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  激活码
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    placeholder="OFFICE-XXXXXXXX"
                    className="h-12 font-mono text-base tracking-wider"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleActivate();
                      }
                    }}
                  />
                  {code && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="!absolute right-1 top-1/2 z-20 h-8 w-8 -translate-y-1/2"
                      onClick={() => setCode('')}
                      aria-label="清除"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  格式：OFFICE-XXXXXXXX（10 位字母数字组合）
                </p>
              </div>

              {/* 试用版限制 */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
                <p className="font-medium text-amber-600 dark:text-amber-400">
                  试用版限制
                </p>
                <ul className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                  <li>• PDF 工具：每次最多处理 3 页/3 个文件</li>
                  <li>• 图片工具：每次最多处理 5 张图片</li>
                  <li>• 二维码：批量生成最多 5 个</li>
                  <li>• 文本工具：最多处理 5000 字</li>
                  <li>• 计算工具：单位换算仅开放 3 类</li>
                  <li>• 导出文件含试用水印</li>
                </ul>
              </div>

              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  onClick={handleActivate}
                  disabled={verifying}
                  className="w-full bg-gradient-to-r from-primary via-purple-500 to-cyan-500 hover:from-primary/90 hover:via-purple-500/90 hover:to-cyan-500/90"
                >
                  {verifying ? '验证中...' : '立即激活'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  className="w-full text-muted-foreground"
                >
                  继续试用
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </header>
  );
}
