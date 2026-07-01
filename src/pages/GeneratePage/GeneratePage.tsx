import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QrCode,
  Type,
  Link,
  Wifi,
  User,
  Mail,
  MessageSquare,
  Phone,
  Download,
  Image as ImageIcon,
  Upload,
  Palette,
  Maximize2,
  ShieldCheck,
  Copy,
  Check,
  X,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@lark-apaas/client-toolkit-lite';
import { useLicense } from '@/contexts/LicenseContext';
import {
  generateQrCode,
  generateContentByType,
  type QrContentType,
  type QrErrorLevel,
  type QrStyle,
  type FinderPatternStyle,
  formatFileSize,
} from '@/utils/qr-processor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

/** 内容类型配置 */
const CONTENT_TYPES: { value: QrContentType; label: string; icon: typeof Type }[] = [
  { value: 'text', label: '文本', icon: Type },
  { value: 'url', label: '网址', icon: Link },
  { value: 'wifi', label: 'WiFi', icon: Wifi },
  { value: 'vcard', label: '名片', icon: User },
  { value: 'email', label: '邮箱', icon: Mail },
  { value: 'sms', label: '短信', icon: MessageSquare },
  { value: 'phone', label: '电话', icon: Phone },
];

/** 容错级别选项 */
const ERROR_LEVELS: { value: QrErrorLevel; label: string; desc: string }[] = [
  { value: 'L', label: '低 (7%)', desc: '低容错，适合简单内容' },
  { value: 'M', label: '中 (15%)', desc: '标准推荐' },
  { value: 'Q', label: '较高 (25%)', desc: '适合加Logo' },
  { value: 'H', label: '高 (30%)', desc: '最高容错，推荐加Logo' },
];

/** 样式模板选项 */
const STYLE_OPTIONS: { value: QrStyle; label: string }[] = [
  { value: 'classic', label: '经典方块' },
  { value: 'dots', label: '圆点' },
  { value: 'squares', label: '圆角方块' },
  { value: 'liquid', label: '液态' },
];

/** 定位点样式选项 */
const FINDER_OPTIONS: { value: FinderPatternStyle; label: string }[] = [
  { value: 'square', label: '方形' },
  { value: 'rounded', label: '圆角' },
  { value: 'circle', label: '圆形' },
];

export default function GeneratePage() {
  const { isTrial } = useLicense();

  // 内容类型
  const [contentType, setContentType] = useState<QrContentType>('url');

  // 内容参数
  const [text, setText] = useState('https://example.com');
  const [url, setUrl] = useState('https://example.com');
  const [wifiSsid, setWifiSsid] = useState('MyWiFi');
  const [wifiPassword, setWifiPassword] = useState('password123');
  const [wifiEncryption, setWifiEncryption] = useState<'WPA' | 'WEP' | 'nopass'>('WPA');
  const [wifiHidden, setWifiHidden] = useState(false);
  const [vcardName, setVcardName] = useState('张三');
  const [vcardPhone, setVcardPhone] = useState('13800138000');
  const [vcardEmail, setVcardEmail] = useState('');
  const [vcardCompany, setVcardCompany] = useState('');
  const [emailAddr, setEmailAddr] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [phoneNum, setPhoneNum] = useState('');

  // 样式参数
  const [size, setSize] = useState(300);
  const [errorLevel, setErrorLevel] = useState<QrErrorLevel>('M');
  const [foreground, setForeground] = useState('#1e1b4b');
  const [background, setBackground] = useState('#ffffff');
  const [style, setStyle] = useState<QrStyle>('classic');
  const [margin, setMargin] = useState(4);
  const [useGradient, setUseGradient] = useState(false);
  const [gradientStart, setGradientStart] = useState('#6366f1');
  const [gradientEnd, setGradientEnd] = useState('#a855f7');
  const [gradientAngle, setGradientAngle] = useState(45);
  const [finderPattern, setFinderPattern] = useState<FinderPatternStyle>('square');
  const [finderColor, setFinderColor] = useState('#1e1b4b');

  // Logo
  const [logoImage, setLogoImage] = useState<HTMLImageElement | null>(null);
  const [logoRatio, setLogoRatio] = useState(0.2);
  const [logoRadius, setLogoRadius] = useState(12);
  const [logoBgColor, setLogoBgColor] = useState('#ffffff');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 预览
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [previewSize, setPreviewSize] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // 高级设置展开
  const [showAdvanced, setShowAdvanced] = useState(false);

  /** 根据类型获取内容参数 */
  const getContentParams = useCallback((): Record<string, string> => {
    switch (contentType) {
      case 'text':
        return { text };
      case 'url':
        return { url };
      case 'wifi':
        return {
          ssid: wifiSsid, password: wifiPassword, encryption: wifiEncryption, hidden: String(wifiHidden) };
      case 'vcard':
        return { name: vcardName, phone: vcardPhone, email: vcardEmail, company: vcardCompany };
      case 'email':
        return { email: emailAddr };
      case 'sms':
        return { phone: smsPhone, message: smsMessage };
      case 'phone':
        return { phone: phoneNum };
      default:
        return { text };
    }
  }, [contentType, text, url, wifiSsid, wifiPassword, wifiEncryption, wifiHidden, vcardName, vcardPhone, vcardEmail, vcardCompany, emailAddr, smsPhone, smsMessage, phoneNum]);

  /** 生成二维码 */
  const generate = useCallback(async () => {
    const content = generateContentByType(contentType, getContentParams());
    if (!content.trim()) {
      toast.warning('请输入二维码内容');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateQrCode({
        content,
        size,
        errorLevel,
        foreground,
        background,
        margin,
        style,
        useGradient,
        gradientStart,
        gradientEnd,
        gradientAngle,
        finderPattern,
        finderColor,
        logoImage,
        logoRatio,
        logoRadius,
        logoBgColor,
        addWatermark: isTrial,
        watermarkText: '试用版',
      });

      canvasRef.current = result.canvas;
      setPreviewUrl(result.dataUrl);
      setPreviewSize(Math.round(result.canvas.toDataURL('image/png').length * 0.75));
    } catch (error) {
      logger.error('Generate QR failed:', String(error));
      toast.error('生成失败，请检查内容是否过长');
    } finally {
      setIsGenerating(false);
    }
  }, [contentType, getContentParams, size, errorLevel, foreground, background, margin, style, useGradient, gradientStart, gradientEnd, gradientAngle, finderPattern, finderColor, logoImage, logoRatio, logoRadius, logoBgColor, isTrial]);

  // 参数变化时自动重新生成
  useEffect(() => {
    const timer = setTimeout(() => {
      generate();
    }, 300);
    return () => clearTimeout(timer);
  }, [generate]);

  /** 处理 Logo 上传 */
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (ev) => {
      img.onload = () => {
        setLogoImage(img);
        toast.success('Logo 上传成功');
      };
      img.src = ev.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  /** 移除 Logo */
  const handleRemoveLogo = useCallback(() => {
    setLogoImage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  /** 下载 PNG */
  const handleDownloadPng = useCallback(() => {
    if (!previewUrl) return;
    const a = document.createElement('a');
    a.href = previewUrl;
    a.download = `qrcode_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success('PNG 下载已开始');
  }, [previewUrl]);

  /** 下载 SVG */
  const handleDownloadSvg = useCallback(async () => {
    const content = generateContentByType(contentType, getContentParams());
    if (!content.trim()) return;

    try {
      // 使用 qrcode 生成 SVG
      const QRCode = (await import('qrcode')).default;
      const svgString = await QRCode.toString(content, {
        type: 'svg',
        errorCorrectionLevel: errorLevel,
        margin,
        width: size,
        color: {
          dark: foreground,
          light: background,
        },
      });

      const blob = new Blob([svgString], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `qrcode_${Date.now()}.svg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success('SVG 下载已开始');
    } catch (error) {
      logger.error('SVG download failed:', String(error));
      toast.error('SVG 导出失败');
    }
  }, [contentType, getContentParams, errorLevel, margin, size, foreground, background]);

  /** 复制内容 */
  const handleCopyContent = useCallback(async () => {
    const content = generateContentByType(contentType, getContentParams());
    try {
      await navigator.clipboard.writeText(content);
      toast.success('内容已复制');
    } catch {
      toast.error('复制失败');
    }
  }, [contentType, getContentParams]);

  /** 重置参数 */
  const handleReset = useCallback(() => {
    setSize(300);
    setErrorLevel('M');
    setForeground('#1e1b4b');
    setBackground('#ffffff');
    setStyle('classic');
    setMargin(4);
    setUseGradient(false);
    setGradientStart('#6366f1');
    setGradientEnd('#a855f7');
    setGradientAngle(45);
    setFinderPattern('square');
    setFinderColor('#1e1b4b');
    setLogoImage(null);
    setLogoRatio(0.2);
    setLogoRadius(12);
    setLogoBgColor('#ffffff');
    toast.success('已重置为默认参数');
  }, []);

  const contentParams = getContentParams();
  const currentContent = useMemo(() => generateContentByType(contentType, contentParams), [contentType, contentParams]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_420px]">
      {/* 左侧：参数设置 */}
      <div className="space-y-6">
        {/* 内容类型选择 */}
        <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Type className="h-5 w-5 text-primary" />
              内容类型
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              {CONTENT_TYPES.map((item) => {
                const Icon = item.icon;
                const active = contentType === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => setContentType(item.value)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-300',
                      active
                        ? 'border-primary/40 bg-primary/10 text-primary shadow-sm'
                        : 'border-border/40 bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/5 hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    <span className="text-xs font-medium">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* 内容输入 */}
        <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-5 w-5 text-primary" />
              内容设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AnimatePresence mode="wait">
              {contentType === 'text' && (
                <motion.div
                  key="text"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <Label>文本内容</Label>
                  <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="请输入要生成二维码的文本内容"
                    className="h-24 w-full resize-none rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </motion.div>
              )}

              {contentType === 'url' && (
                <motion.div
                  key="url"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <Label>网址链接</Label>
                  <Input
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com"
                  />
                </motion.div>
              )}

              {contentType === 'wifi' && (
                <motion.div
                  key="wifi"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <div className="space-y-2">
                    <Label>WiFi 名称 (SSID)</Label>
                    <Input value={wifiSsid} onChange={(e) => setWifiSsid(e.target.value)} placeholder="MyWiFi" />
                  </div>
                  <div className="space-y-2">
                    <Label>加密方式</Label>
                    <Select value={wifiEncryption} onValueChange={(v) => setWifiEncryption(v as typeof wifiEncryption)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WPA">WPA/WPA2</SelectItem>
                        <SelectItem value="WEP">WEP</SelectItem>
                        <SelectItem value="nopass">无密码</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {wifiEncryption !== 'nopass' && (
                    <div className="space-y-2">
                    <Label>WiFi 密码</Label>
                    <Input
                      type="text"
                      value={wifiPassword}
                      onChange={(e) => setWifiPassword(e.target.value)}
                      placeholder="请输入WiFi密码"
                    />
                  </div>
                  )}
                  <div className="flex items-center gap-2">
                    <Switch id="wifi-hidden" checked={wifiHidden} onCheckedChange={setWifiHidden} />
                    <Label htmlFor="wifi-hidden" className="text-sm">隐藏网络</Label>
                  </div>
                </motion.div>
              )}

              {contentType === 'vcard' && (
                <motion.div
                  key="vcard"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label>姓名 *</Label>
                    <Input value={vcardName} onChange={(e) => setVcardName(e.target.value)} placeholder="张三" />
                  </div>
                  <div className="space-y-2">
                    <Label>电话</Label>
                    <Input value={vcardPhone} onChange={(e) => setVcardPhone(e.target.value)} placeholder="13800138000" />
                  </div>
                  <div className="space-y-2">
                    <Label>邮箱</Label>
                    <Input value={vcardEmail} onChange={(e) => setVcardEmail(e.target.value)} placeholder="example@email.com" />
                  </div>
                  <div className="space-y-2">
                    <Label>公司</Label>
                    <Input value={vcardCompany} onChange={(e) => setVcardCompany(e.target.value)} placeholder="公司名称" />
                  </div>
                </motion.div>
              )}

              {contentType === 'email' && (
                <motion.div
                  key="email"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <Label>邮箱地址</Label>
                  <Input type="email" value={emailAddr} onChange={(e) => setEmailAddr(e.target.value)} placeholder="example@email.com" />
                </motion.div>
              )}

              {contentType === 'sms' && (
                <motion.div
                  key="sms"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-3"
                >
                  <div className="space-y-2">
                    <Label>手机号码</Label>
                    <Input value={smsPhone} onChange={(e) => setSmsPhone(e.target.value)} placeholder="13800138000" />
                  </div>
                  <div className="space-y-2">
                    <Label>短信内容</Label>
                    <textarea
                      value={smsMessage}
                      onChange={(e) => setSmsMessage(e.target.value)}
                      placeholder="请输入短信内容"
                      className="h-20 w-full resize-none rounded-lg border border-input bg-background/50 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  </div>
                </motion.div>
              )}

              {contentType === 'phone' && (
                <motion.div
                  key="phone"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-2"
                >
                  <Label>电话号码</Label>
                  <Input value={phoneNum} onChange={(e) => setPhoneNum(e.target.value)} placeholder="13800138000" />
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* 基础样式 */}
        <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Palette className="h-5 w-5 text-primary" />
              样式设置
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 尺寸 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">尺寸大小</Label>
                <span className="text-sm font-medium text-primary">{size}px</span>
              </div>
              <Slider value={[size]} onValueChange={([v]) => setSize(v)} min={100} max={1000} step={10} />
            </div>

            {/* 容错级别 */}
            <div className="space-y-2">
              <Label className="text-sm">容错级别</Label>
              <Select value={errorLevel} onValueChange={(v) => setErrorLevel(v as QrErrorLevel)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ERROR_LEVELS.map((el) => (
                    <SelectItem key={el.value} value={el.value}>
                      <div className="flex flex-col">
                        <span className="font-medium">{el.label}</span>
                        <span className="text-xs text-muted-foreground">{el.desc}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 颜色*/}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-sm">前景色</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-border shadow-inner"
                    style={{ backgroundColor: foreground }}
                  />
                  <Input
                    type="text"
                    value={foreground}
                    onChange={(e) => setForeground(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm">背景色</Label>
                <div className="flex items-center gap-2">
                  <div
                    className="h-9 w-9 shrink-0 cursor-pointer rounded-lg border border-border shadow-inner"
                    style={{ backgroundColor: background }}
                  />
                  <Input
                    type="text"
                    value={background}
                    onChange={(e) => setBackground(e.target.value)}
                    className="font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* 样式模板 */}
            <div className="space-y-2">
              <Label className="text-sm">样式模板</Label>
              <div className="grid grid-cols-4 gap-2">
                {STYLE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setStyle(opt.value)}
                    className={cn(
                      'rounded-lg border px-2 py-2 text-xs font-medium transition-all',
                      style === opt.value
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-border/40 bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/5'
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 高级设置展开 */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex w-full items-center justify-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {showAdvanced ? '收起高级设置' : '展开高级设置'}
            </button>

            <AnimatePresence>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-5 overflow-hidden"
                >
                  {/* 内边距 */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">内边距</Label>
                      <span className="text-sm font-medium text-primary">{margin}</span>
                    </div>
                    <Slider value={[margin]} onValueChange={([v]) => setMargin(v)} min={0} max={10} step={1} />
                  </div>

                  {/* 渐变色开关 */}
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">渐变色</Label>
                    <Switch checked={useGradient} onCheckedChange={setUseGradient} />
                  </div>

                  {useGradient && (
                    <div className="space-y-3 rounded-lg border border-border/40 bg-background/30 p-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs">起始色</Label>
                          <div className="flex items-center gap-1.5">
                            <div className="h-7 w-7 shrink-0 rounded-md border border-border" style={{ backgroundColor: gradientStart }} />
                            <Input type="text" value={gradientStart} onChange={(e) => setGradientStart(e.target.value)} className="font-mono text-[10px" />
                          </div>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">结束色</Label>
                          <div className="flex items-center gap-1.5">
                            <div className="h-7 w-7 shrink-0 rounded-md border border-border" style={{ backgroundColor: gradientEnd }} />
                            <Input type="text" value={gradientEnd} onChange={(e) => setGradientEnd(e.target.value)} className="font-mono text-[10px]" />
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">角度</Label>
                          <span className="text-xs font-medium text-primary">{gradientAngle}°</span>
                        </div>
                        <Slider value={[gradientAngle]} onValueChange={([v]) => setGradientAngle(v)} min={0} max={360} step={1} />
                      </div>
                    </div>
                  )}

                  {/* 定位点样式 */}
                  <div className="space-y-2">
                    <Label className="text-sm">定位点样式</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {FINDER_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setFinderPattern(opt.value)}
                          className={cn(
                            'rounded-lg border px-2 py-1.5 text-xs font-medium transition-all',
                            finderPattern === opt.value
                              ? 'border-primary/40 bg-primary/10 text-primary'
                              : 'border-border/40 bg-card/30 text-muted-foreground hover:border-primary/30 hover:bg-primary/5'
                          )}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 定位点颜色 */}
                  <div className="space-y-2">
                    <Label className="text-sm">定位点颜色</Label>
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 shrink-0 rounded-lg border border-border shadow-inner" style={{ backgroundColor: finderColor }} />
                      <Input type="text" value={finderColor} onChange={(e) => setFinderColor(e.target.value)} className="font-mono text-xs" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        {/* Logo 设置 */}
        <Card className="border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <ImageIcon className="h-5 w-5 text-primary" />
              Logo 设置
            </CardTitle>
            <CardDescription>在二维码中心添加 Logo 图片</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!logoImage ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/60 bg-background/30 py-8 text-center transition-all hover:border-primary/40 hover:bg-primary/5"
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">点击上传 Logo 图片</p>
                <p className="text-xs text-muted-foreground/70">支持 PNG/JPG，建议正方形</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-background/30 p-3">
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border/40 bg-white">
                    <Image src={logoImage.src} alt="Logo" className="h-full w-full object-contain" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">已上传 Logo</p>
                    <p className="text-xs text-muted-foreground">{logoImage.width} × {logoImage.height}px</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={handleRemoveLogo} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Logo 大小</Label>
                    <span className="text-xs font-medium text-primary">{Math.round(logoRatio * 100)}%</span>
                  </div>
                  <Slider value={[logoRatio * 100]} onValueChange={([v]) => setLogoRatio(v / 100)} min={5} max={30} step={1} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">背景圆角</Label>
                    <span className="text-xs font-medium text-primary">{logoRadius}px</span>
                  </div>
                  <Slider value={[logoRadius]} onValueChange={([v]) => setLogoRadius(v)} min={0} max={30} step={1} />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Logo 背景色</Label>
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 shrink-0 rounded-md border border-border shadow-inner" style={{ backgroundColor: logoBgColor }} />
                    <Input type="text" value={logoBgColor} onChange={(e) => setLogoBgColor(e.target.value)} className="font-mono text-xs" />
                  </div>
                </div>
              </div>
            )}
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
          </CardContent>
        </Card>
      </div>

      {/* 右侧：实时预览 */}
      <div className="space-y-6">
        <Card className="sticky top-24 border-white/20 bg-white/40 backdrop-blur-xl shadow-lg shadow-primary/5 dark:border-white/10 dark:bg-background/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Eye className="h-5 w-5 text-primary" />
                实时预览
              </CardTitle>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={handleReset} title="重置">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* 预览区 */}
            <div className="relative flex aspect-square w-full items-center justify-center rounded-xl border border-border/40 bg-background/50 p-6">
              <AnimatePresence mode="wait">
                {isGenerating ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <span className="text-sm text-muted-foreground">生成中...</span>
                  </motion.div>
                ) : previewUrl ? (
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.3 }}
                    className="relative"
                  >
                    <Image
                      src={previewUrl}
                      alt="QR Code"
                      className="max-h-full max-w-full rounded-lg shadow-md"
                      style={{ maxHeight: '320px', maxWidth: '320px' }}
                    />
                    {isTrial && (
                      <Badge variant="outline" className="absolute -top-2 -right-2 border-amber-500/40 bg-amber-50 text-amber-600">
                        试用版
                      </Badge>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex flex-col items-center gap-2 text-muted-foreground"
                  >
                    <QrCode className="h-12 w-12 opacity-30" />
                    <span className="text-sm">输入内容生成二维码</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* 文件信息 */}
            {previewUrl && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                  <p className="text-xs text-muted-foreground">尺寸</p>
                  <p className="font-semibold text-foreground">{size} × {size}px</p>
                </div>
                <div className="rounded-lg border border-border/40 bg-background/30 p-3">
                  <p className="text-xs text-muted-foreground">预估大小</p>
                  <p className="font-semibold text-foreground">{formatFileSize(previewSize)}</p>
                </div>
              </div>
            )}

            {/* 内容预览 */}
            {currentContent && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">二维码内容</Label>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleCopyContent}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="max-h-20 overflow-auto rounded-lg border border-border/40 bg-background/30 p-2">
                  <p className="break-all font-mono text-xs text-muted-foreground">{currentContent}</p>
                </div>
              </div>
            )}

            {/* 下载按钮 */}
            <div className="grid grid-cols-2 gap-3">
              <Button onClick={handleDownloadPng} disabled={!previewUrl} className="gap-2">
                <Download className="h-4 w-4" />
                下载 PNG
              </Button>
              <Button variant="secondary" onClick={handleDownloadSvg} disabled={!previewUrl} className="gap-2">
                <Download className="h-4 w-4" />
                下载 SVG
              </Button>
            </div>

            {isTrial && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>试用版导出的二维码图片带有轻微水印，激活后可去除水印并解锁更多功能。</span>
            </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
