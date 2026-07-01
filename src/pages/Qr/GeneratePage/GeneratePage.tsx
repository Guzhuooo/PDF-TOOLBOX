import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import QRCode from 'qrcode';
import {
  QrCode,
  Download,
  Copy,
  Check,
  RefreshCw,
  Type,
  Globe,
  Wifi,
  Mail,
  User,
  Palette,
  Maximize2,
  Shield,
  ImagePlus,
  X,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

import { useLicense } from '@/contexts/LicenseContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Image } from '@/components/ui/image';
import { cn } from '@/lib/utils';

/* ============================================================
 *  类型定义
 * ============================================================ */

type QrType = 'text' | 'url' | 'wifi' | 'vcard' | 'email';
type ErrorLevel = 'L' | 'M' | 'Q' | 'H';

interface WifiData {
  ssid: string;
  password: string;
  encryption: 'WPA' | 'WEP' | 'nopass';
  hidden: boolean;
}

interface VCardData {
  name: string;
  phone: string;
  email: string;
  company: string;
  title: string;
  url: string;
}

interface EmailData {
  to: string;
  subject: string;
  body: string;
}

/* ============================================================
 *  简易二维码生成器（纯前端实现，无需第三方库）
 *  基于 Reed-Solomon 纠错 + 标准 QR Code 算法
 *  为了代码简洁，这里使用 qrcode-generator 风格的简化实现
 *  实际项目中推荐使用 qrcode.js 或 qrcode-generator 库
 * ============================================================ */

/**
 * 生成二维码 Canvas
 * 使用 qrcode 库真实生成可扫描的二维码
 */
function generateQrCodeCanvas(
  text: string,
  size: number,
  errorLevel: ErrorLevel,
  fgColor: string,
  bgColor: string,
): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  try {
    QRCode.toCanvas(canvas, text, {
      width: size,
      margin: 2,
      errorCorrectionLevel: errorLevel as any,
      color: {
        dark: fgColor,
        light: bgColor,
      },
    });
    return canvas;
  } catch {
    return null;
  }
}

/**
 * Fallback 伪二维码绘制（演示用）
 * 基于文本哈希生成确定性图案
 */
function drawFallbackQr(
  ctx: CanvasRenderingContext2D,
  size: number,
  text: string,
  fgColor: string,
  bgColor: string,
) {
  // 简单哈希
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }

  const gridSize = 25; // 25x25 网格
  const cellSize = Math.floor(size / (gridSize + 4));
  const offset = Math.floor((size - cellSize * gridSize) / 2);

  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = fgColor;

  // 绘制三个定位角
  drawFinderPattern(ctx, offset, offset, cellSize);
  drawFinderPattern(ctx, offset + (gridSize - 7) * cellSize, offset, cellSize);
  drawFinderPattern(ctx, offset, offset + (gridSize - 7) * cellSize, cellSize);

  // 基于文本哈希生成数据区图案
  let seed = Math.abs(hash) || 1;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // 跳过定位角区域
      if (row < 8 && col < 8) continue;
      if (row < 8 && col >= gridSize - 8) continue;
      if (row >= gridSize - 8 && col < 8) continue;

      if (rand() > 0.5) {
        ctx.fillRect(offset + col * cellSize, offset + row * cellSize, cellSize, cellSize);
      }
    }
  }
}

/** 绘制定位角 */
function drawFinderPattern(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number) {
  // 外框 7x7
  for (let i = 0; i < 7; i++) {
    for (let j = 0; j < 7; j++) {
      const isBorder = i === 0 || i === 6 || j === 0 || j === 6;
      const isCenter = i >= 2 && i <= 4 && j >= 2 && j <= 4;
      if (isBorder || isCenter) {
        ctx.fillRect(x + j * cellSize, y + i * cellSize, cellSize, cellSize);
      }
    }
  }
}

/**
 * 生成二维码 SVG 字符串
 */
function generateQrCodeSvg(
  text: string,
  size: number,
  errorLevel: ErrorLevel,
  fgColor: string,
  bgColor: string,
): string {
  const canvas = generateQrCodeCanvas(text, size, errorLevel, fgColor, bgColor);
  if (!canvas) return '';

  // 将 canvas 转为 SVG（简单方式：用 image 嵌入）
  const dataUrl = canvas.toDataURL('image/png');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" fill="${bgColor}"/>
    <image href="${dataUrl}" width="${size}" height="${size}"/>
  </svg>`;
}

/**
 * 生成带 Logo 的二维码
 */
function generateQrWithLogo(
  text: string,
  size: number,
  errorLevel: ErrorLevel,
  fgColor: string,
  bgColor: string,
  logoImg: HTMLImageElement | null,
): HTMLCanvasElement | null {
  const canvas = generateQrCodeCanvas(text, size, errorLevel, fgColor, bgColor);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  if (logoImg) {
    const logoSize = Math.floor(size * 0.22);
    const logoX = Math.floor((size - logoSize) / 2);
    const logoY = Math.floor((size - logoSize) / 2);

    // 白色背景圆角矩形
    const padding = Math.floor(logoSize * 0.1);
    ctx.fillStyle = bgColor;
    roundRect(ctx, logoX - padding, logoY - padding, logoSize + padding * 2, logoSize + padding * 2, 8);
    ctx.fill();

    // 绘制 Logo
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, logoX, logoY, logoSize, logoSize, 6);
    ctx.clip();
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize);
    ctx.restore();
  }

  return canvas;
}

/** 圆角矩形路径 */
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/* ============================================================
 *  二维码内容生成
 * ============================================================ */

function buildWifiString(data: WifiData): string {
  const { ssid, password, encryption, hidden } = data;
  const enc = encryption === 'nopass' ? 'nopass' : encryption;
  let str = `WIFI:T:${enc};S:${escapeQrString(ssid)};`;
  if (password && encryption !== 'nopass') {
    str += `P:${escapeQrString(password)};`;
  }
  if (hidden) {
    str += 'H:true;';
  }
  str += ';';
  return str;
}

function buildVCardString(data: VCardData): string {
  const lines = ['BEGIN:VCARD', 'VERSION:3.0'];
  if (data.name) lines.push(`FN:${data.name}`);
  if (data.company) lines.push(`ORG:${data.company}`);
  if (data.title) lines.push(`TITLE:${data.title}`);
  if (data.phone) lines.push(`TEL:${data.phone}`);
  if (data.email) lines.push(`EMAIL:${data.email}`);
  if (data.url) lines.push(`URL:${data.url}`);
  lines.push('END:VCARD');
  return lines.join('\n');
}

function buildEmailString(data: EmailData): string {
  let str = `mailto:${data.to || ''}`;
  const params: string[] = [];
  if (data.subject) params.push(`subject=${encodeURIComponent(data.subject)}`);
  if (data.body) params.push(`body=${encodeURIComponent(data.body)}`);
  if (params.length > 0) str += `?${params.join('&')}`;
  return str;
}

function escapeQrString(str: string): string {
  return str.replace(/([\\;:,"])/g, '\\$1');
}

/* ============================================================
 *  页面组件
 * ============================================================ */

const QR_TYPES: { value: QrType; label: string; icon: typeof Type }[] = [
  { value: 'text', label: '文本', icon: Type },
  { value: 'url', label: '网址', icon: Globe },
  { value: 'wifi', label: 'WiFi', icon: Wifi },
  { value: 'vcard', label: '名片', icon: User },
  { value: 'email', label: '邮箱', icon: Mail },
];

const ERROR_LEVELS: { value: ErrorLevel; label: string; desc: string }[] = [
  { value: 'L', label: '低 (7%)', desc: '约7%纠错能力' },
  { value: 'M', label: '中 (15%)', desc: '约15%纠错能力' },
  { value: 'Q', label: '较高 (25%)', desc: '约25%纠错能力' },
  { value: 'H', label: '高 (30%)', desc: '约30%纠错能力，推荐带Logo' },
];

const PRESET_COLORS = [
  { fg: '#000000', bg: '#ffffff', name: '经典黑白' },
  { fg: '#1e40af', bg: '#ffffff', name: '深蓝白' },
  { fg: '#7c3aed', bg: '#faf5ff', name: '紫色' },
  { fg: '#059669', bg: '#ecfdf5', name: '绿色' },
  { fg: '#dc2626', bg: '#fef2f2', name: '红色' },
  { fg: '#d97706', bg: '#fffbeb', name: '金色' },
];

export default function QrGeneratePage() {
  const { isTrial } = useLicense();

  // 二维码类型
  const [qrType, setQrType] = useState<QrType>('text');

  // 内容数据
  const [textContent, setTextContent] = useState('https://www.example.com');
  const [urlContent, setUrlContent] = useState('https://www.example.com');
  const [wifiData, setWifiData] = useState<WifiData>({
    ssid: 'MyWiFi',
    password: '12345678',
    encryption: 'WPA',
    hidden: false,
  });
  const [vcardData, setVcardData] = useState<VCardData>({
    name: '张三',
    phone: '13800138000',
    email: 'zhangsan@example.com',
    company: '示例公司',
    title: '产品经理',
    url: 'https://www.example.com',
  });
  const [emailData, setEmailData] = useState<EmailData>({
    to: 'contact@example.com',
    subject: '你好',
    body: '',
  });

  // 样式参数
  const [size, setSize] = useState(300);
  const [errorLevel, setErrorLevel] = useState<ErrorLevel>('M');
  const [fgColor, setFgColor] = useState('#000000');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const logoImgRef = useRef<HTMLImageElement | null>(null);

  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);

  /* ============================================================
   *  计算二维码内容
   * ============================================================ */
  const qrContent = useMemo(() => {
    switch (qrType) {
      case 'text':
        return textContent || ' ';
      case 'url':
        return urlContent || 'https://';
      case 'wifi':
        return buildWifiString(wifiData);
      case 'vcard':
        return buildVCardString(vcardData);
      case 'email':
        return buildEmailString(emailData);
      default:
        return '';
    }
  }, [qrType, textContent, urlContent, wifiData, vcardData, emailData]);

  /* ============================================================
   *  生成二维码
   * ============================================================ */
  const generateQr = useCallback(() => {
    if (!qrContent) return;

    const canvas = generateQrWithLogo(
      qrContent,
      size,
      errorLevel,
      fgColor,
      bgColor,
      logoImgRef.current,
    );

    if (canvas && qrCanvasRef.current) {
      const ctx = qrCanvasRef.current.getContext('2d');
      if (ctx) {
        qrCanvasRef.current.width = size;
        qrCanvasRef.current.height = size;
        ctx.drawImage(canvas, 0, 0);
      }
    }
  }, [qrContent, size, errorLevel, fgColor, bgColor]);

  useEffect(() => {
    const timer = setTimeout(() => {
      generateQr();
    }, 100);
    return () => clearTimeout(timer);
  }, [generateQr]);

  /* ============================================================
   *  Logo 上传处理
   * ============================================================ */
  const handleLogoUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('请上传图片文件');
      return;
    }

    setLogoFile(file);
    const url = URL.createObjectURL(file);
    setLogoPreview(url);

    const img = new Image();
    img.onload = () => {
      logoImgRef.current = img;
      generateQr();
    };
    img.src = url;
  }, [generateQr]);

  const handleRemoveLogo = useCallback(() => {
    setLogoFile(null);
    setLogoPreview(null);
    logoImgRef.current = null;
    if (logoPreview) {
      URL.revokeObjectURL(logoPreview);
    }
    generateQr();
  }, [logoPreview, generateQr]);

  /* ============================================================
   *  下载功能
   * ============================================================ */
  const downloadPng = useCallback(() => {
    if (!qrCanvasRef.current) return;
    const link = document.createElement('a');
    link.download = `二维码_${qrType}.png`;
    link.href = qrCanvasRef.current.toDataURL('image/png');
    link.click();
    toast.success('PNG 已下载');
  }, [qrType]);

  const downloadSvg = useCallback(() => {
    const svg = generateQrCodeSvg(qrContent, size, errorLevel, fgColor, bgColor);
    if (!svg) return;
    const blob = new Blob([svg], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `二维码_${qrType}.svg`;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('SVG 已下载');
  }, [qrContent, size, errorLevel, fgColor, bgColor, qrType]);

  const handleCopy = useCallback(async () => {
    if (!qrCanvasRef.current) return;
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        qrCanvasRef.current?.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('生成失败'));
        }, 'image/png');
      });
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      setCopied(true);
      toast.success('二维码已复制到剪贴板');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error('复制失败，请尝试下载');
    }
  }, []);

  const handlePresetColor = useCallback((fg: string, bg: string) => {
    setFgColor(fg);
    setBgColor(bg);
  }, []);

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
              <QrCode className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">二维码生成</h1>
            <p className="text-sm text-muted-foreground">
              支持文本、网址、WiFi、名片、邮箱等多种类型
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isTrial && (
            <Badge variant="secondary" className="text-xs">
              试用版 · 批量最多5个
            </Badge>
          )}
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：配置区 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-3 space-y-4"
        >
          {/* 类型选择 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                二维码类型
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs value={qrType} onValueChange={(v) => setQrType(v as QrType)}>
                <TabsList className="w-full grid grid-cols-5 bg-muted/30 p-1">
                  {QR_TYPES.map((t) => {
                    const Icon = t.icon;
                    return (
                      <TabsTrigger key={t.value} value={t.value} className="flex flex-col gap-1 py-2 h-auto">
                        <Icon className="h-4 w-4" />
                        <span className="text-xs">{t.label}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                {/* 文本 */}
                <TabsContent value="text" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">文本内容</Label>
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="请输入要生成二维码的文本内容"
                      rows={4}
                      className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                    <p className="text-xs text-muted-foreground">
                      字符数：{textContent.length}
                    </p>
                  </div>
                </TabsContent>

                {/* 网址 */}
                <TabsContent value="url" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">网址链接</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        type="url"
                        value={urlContent}
                        onChange={(e) => setUrlContent(e.target.value)}
                        placeholder="https://www.example.com"
                        className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* WiFi */}
                <TabsContent value="wifi" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">网络名称 (SSID)</Label>
                    <Input
                      value={wifiData.ssid}
                      onChange={(e) => setWifiData({ ...wifiData, ssid: e.target.value })}
                      placeholder="WiFi 名称"
                      className="bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">加密方式</Label>
                    <Select
                      value={wifiData.encryption}
                      onValueChange={(v) => setWifiData({ ...wifiData, encryption: v as WifiData['encryption'] })}
                    >
                      <SelectTrigger className="bg-background/50 border-border/50">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="WPA">WPA/WPA2/WPA3</SelectItem>
                        <SelectItem value="WEP">WEP</SelectItem>
                        <SelectItem value="nopass">无密码</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {wifiData.encryption !== 'nopass' && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">密码</Label>
                      <Input
                        type="text"
                        value={wifiData.password}
                        onChange={(e) => setWifiData({ ...wifiData, password: e.target.value })}
                        placeholder="WiFi 密码"
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="hidden-wifi"
                      checked={wifiData.hidden}
                      onChange={(e) => setWifiData({ ...wifiData, hidden: e.target.checked })}
                      className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30"
                    />
                    <Label htmlFor="hidden-wifi" className="text-sm cursor-pointer">
                      隐藏网络
                    </Label>
                  </div>
                </TabsContent>

                {/* 名片 */}
                <TabsContent value="vcard" className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">姓名</Label>
                      <Input
                        value={vcardData.name}
                        onChange={(e) => setVcardData({ ...vcardData, name: e.target.value })}
                        placeholder="姓名"
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">电话</Label>
                      <Input
                        value={vcardData.phone}
                        onChange={(e) => setVcardData({ ...vcardData, phone: e.target.value })}
                        placeholder="电话号码"
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">邮箱</Label>
                      <Input
                        value={vcardData.email}
                        onChange={(e) => setVcardData({ ...vcardData, email: e.target.value })}
                        placeholder="邮箱地址"
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">公司</Label>
                      <Input
                        value={vcardData.company}
                        onChange={(e) => setVcardData({ ...vcardData, company: e.target.value })}
                        placeholder="公司名称"
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">职位</Label>
                      <Input
                        value={vcardData.title}
                        onChange={(e) => setVcardData({ ...vcardData, title: e.target.value })}
                        placeholder="职位"
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">网站</Label>
                      <Input
                        value={vcardData.url}
                        onChange={(e) => setVcardData({ ...vcardData, url: e.target.value })}
                        placeholder="网址"
                        className="bg-background/50 border-border/50 focus:border-primary/50"
                      />
                    </div>
                  </div>
                </TabsContent>

                {/* 邮箱 */}
                <TabsContent value="email" className="mt-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">收件人</Label>
                    <Input
                      value={emailData.to}
                      onChange={(e) => setEmailData({ ...emailData, to: e.target.value })}
                      placeholder="收件人邮箱"
                      className="bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">主题</Label>
                    <Input
                      value={emailData.subject}
                      onChange={(e) => setEmailData({ ...emailData, subject: e.target.value })}
                      placeholder="邮件主题"
                      className="bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">正文</Label>
                    <textarea
                      value={emailData.body}
                      onChange={(e) => setEmailData({ ...emailData, body: e.target.value })}
                      placeholder="邮件正文内容"
                      rows={3}
                      className="w-full rounded-lg border border-border/50 bg-background/50 px-3 py-2 text-sm focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* 样式设置 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                样式设置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 尺寸 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-2">
                    <Maximize2 className="h-4 w-4 text-muted-foreground" />
                    尺寸
                  </Label>
                  <span className="text-sm text-muted-foreground tabular-nums">{size}px</span>
                </div>
                <Slider
                  value={[size]}
                  onValueChange={([v]) => setSize(v)}
                  min={100}
                  max={1000}
                  step={10}
                  className="py-2"
                />
                <div className="flex gap-2">
                  {[200, 300, 500, 800].map((s) => (
                    <button
                      key={s}
                      onClick={() => setSize(s)}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-md transition-colors',
                        size === s
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {s}px
                    </button>
                  ))}
                </div>
              </div>

              {/* 容错级别 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  容错级别
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {ERROR_LEVELS.map((level) => (
                    <button
                      key={level.value}
                      onClick={() => setErrorLevel(level.value)}
                      title={level.desc}
                      className={cn(
                        'py-2 px-1 text-xs rounded-lg border transition-all',
                        errorLevel === level.value
                          ? 'border-primary/50 bg-primary/10 text-primary font-medium'
                          : 'border-border/50 bg-background/30 text-muted-foreground hover:border-border hover:text-foreground',
                      )}
                    >
                      {level.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 颜色预设 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">颜色预设</Label>
                <div className="flex flex-wrap gap-2">
                  {PRESET_COLORS.map((c, i) => (
                    <button
                      key={i}
                      onClick={() => handlePresetColor(c.fg, c.bg)}
                      title={c.name}
                      className={cn(
                        'w-10 h-10 rounded-lg border-2 transition-all overflow-hidden',
                        fgColor === c.fg && bgColor === c.bg
                          ? 'border-primary scale-110 shadow-md'
                          : 'border-border/50 hover:border-border',
                      )}
                    >
                      <div className="w-full h-full" style={{ background: `linear-gradient(135deg, ${c.fg} 0%, ${c.fg} 50%, ${c.bg} 50%, ${c.bg} 100%)` }} />
                    </button>
                  ))}
                </div>
              </div>

              {/* 自定义颜色 */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">前景色</Label>
                  <div className="flex gap-2">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border/50 shrink-0">
                      <input
                        type="color"
                        value={fgColor}
                        onChange={(e) => setFgColor(e.target.value)}
                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      />
                      <div className="w-full h-full" style={{ backgroundColor: fgColor }} />
                    </div>
                    <Input
                      value={fgColor}
                      onChange={(e) => setFgColor(e.target.value)}
                      className="font-mono text-sm bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">背景色</Label>
                  <div className="flex gap-2">
                    <div className="relative w-10 h-10 rounded-lg overflow-hidden border border-border/50 shrink-0">
                      <input
                        type="color"
                        value={bgColor}
                        onChange={(e) => setBgColor(e.target.value)}
                        className="absolute inset-0 w-full h-full cursor-pointer opacity-0"
                      />
                      <div className="w-full h-full" style={{ backgroundColor: bgColor }} />
                    </div>
                    <Input
                      value={bgColor}
                      onChange={(e) => setBgColor(e.target.value)}
                      className="font-mono text-sm bg-background/50 border-border/50 focus:border-primary/50"
                    />
                  </div>
                </div>
              </div>

              {/* Logo 上传 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <ImagePlus className="h-4 w-4 text-muted-foreground" />
                  Logo 图标（可选）
                </Label>
                {logoPreview ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-background/30">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-white flex items-center justify-center shrink-0">
                      <Image src={logoPreview} alt="Logo" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{logoFile?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        推荐使用高容错级别（H）
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRemoveLogo}
                      className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center w-full h-20 rounded-lg border-2 border-dashed border-border/50 bg-background/20 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors">
                    <ImagePlus className="h-5 w-5 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground">点击上传 Logo 图片</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：预览区 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-2 space-y-4"
        >
          {/* 二维码预览 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold">预览</CardTitle>
              <CardDescription className="text-xs">
                实时预览二维码效果
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center p-4 rounded-xl bg-muted/30 min-h-[320px]">
                <div className="relative">
                  <div className="absolute -inset-4 rounded-2xl bg-primary/10 blur-xl opacity-50" />
                  <div className="relative p-4 rounded-xl bg-white shadow-lg">
                    <canvas
                      ref={qrCanvasRef}
                      width={size}
                      height={size}
                      style={{ width: Math.min(size, 260), height: Math.min(size, 260), display: 'block' }}
                    />
                  </div>
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <Button onClick={downloadPng} className="gap-2">
                  <Download className="h-4 w-4" />
                  下载 PNG
                </Button>
                <Button variant="outline" onClick={downloadSvg} className="gap-2">
                  <Download className="h-4 w-4" />
                  下载 SVG
                </Button>
                <Button variant="outline" onClick={handleCopy} className="gap-2 col-span-2">
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-success" />
                      已复制
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" />
                      复制到剪贴板
                    </>
                  )}
                </Button>
              </div>

              {/* 重新生成按钮 */}
              <Button
                variant="ghost"
                size="sm"
                onClick={generateQr}
                className="w-full gap-2 text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="h-4 w-4" />
                重新生成
              </Button>
            </CardContent>
          </Card>

          {/* 内容预览 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-muted-foreground">
                二维码内容
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-foreground break-all line-clamp-4 font-mono bg-muted/30 p-3 rounded-lg">
                {qrContent}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
