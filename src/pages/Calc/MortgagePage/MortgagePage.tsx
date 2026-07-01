import { useState, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calculator,
  Home,
  TrendingUp,
  DollarSign,
  Calendar,
  Percent,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  Copy,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import {
  calculateEqualPayment,
  calculateEqualPrincipal,
  type MortgageResult,
  type MortgagePaymentItem,
} from '@/utils/mortgage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function MortgagePage() {
  const { isTrial } = useLicense();

  // 输入参数
  const [loanAmount, setLoanAmount] = useState<string>('1000000');
  const [loanYears, setLoanYears] = useState<string>('30');
  const [annualRate, setAnnualRate] = useState<string>('4.2');
  const [method, setMethod] = useState<'equal-payment' | 'equal-principal'>('equal-payment');
  const [showSchedule, setShowSchedule] = useState(false);
  const [copied, setCopied] = useState(false);

  /** 计算结果 */
  const result = useMemo<MortgageResult | null>(() => {
    const amount = parseFloat(loanAmount);
    const years = parseFloat(loanYears);
    const rate = parseFloat(annualRate);

    if (isNaN(amount) || isNaN(years) || isNaN(rate) || amount <= 0 || years <= 0 || rate <= 0) {
      return null;
    }

    const months = Math.round(years * 12);
    const monthlyRate = rate / 100 / 12;

    if (method === 'equal-payment') {
      return calculateEqualPayment({
        loanAmount: amount,
        years,
        annualRate: rate,
        type: 'equal-principal-interest',
      });
    }
    return calculateEqualPrincipal({
      loanAmount: amount,
      years,
      annualRate: rate,
      type: 'equal-principal',
    });
  }, [loanAmount, loanYears, annualRate, method]);

  /** 格式化金额 */
  const formatMoney = useCallback((val: number): string => {
    return val.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }, []);

  /** 复制结果 */
  const handleCopy = useCallback(async () => {
    if (!result) return;
    const text = [
      '=== 房贷计算结果 ===',
      `贷款金额：${formatMoney(parseFloat(loanAmount))} 元`,
      `贷款期限：${loanYears} 年（${result.totalMonths} 期）`,
      `年利率：${annualRate}%`,
      `还款方式：${method === 'equal-payment' ? '等额本息' : '等额本金'}`,
      '',
      `月供：${formatMoney(result.firstMonthPayment)} 元${method === 'equal-principal' ? '（首月）' : ''}`,
      `总还款额：${formatMoney(result.totalPayment)} 元`,
      `总利息：${formatMoney(result.totalInterest)} 元`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, [result, loanAmount, loanYears, annualRate, method, formatMoney]);

  /** 导出还款明细 */
  const handleExport = useCallback(() => {
    if (!result) return;

    const lines = [
      '=== 房贷还款明细表 ===',
      `贷款金额：${formatMoney(parseFloat(loanAmount))} 元`,
      `贷款期限：${loanYears} 年（${result.totalMonths} 期）`,
      `年利率：${annualRate}%`,
      `还款方式：${method === 'equal-payment' ? '等额本息' : '等额本金'}`,
      `月供：${formatMoney(result.firstMonthPayment)} 元${method === 'equal-principal' ? '（首月）' : ''}`,
      `总还款额：${formatMoney(result.totalPayment)} 元`,
      `总利息：${formatMoney(result.totalInterest)} 元`,
      '',
      '期次,月供(元),本金(元),利息(元),剩余本金(元)',
      ...result.schedule.map((item) =>
        `${item.period},${formatMoney(item.monthlyPayment)},${formatMoney(item.principal)},${formatMoney(item.interest)},${formatMoney(item.remainingPrincipal)}`,
      ),
      '',
      '---',
      '由全能计算器生成',
    ];

    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `房贷计算_${method === 'equal-payment' ? '等额本息' : '等额本金'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success('还款明细已导出');
  }, [result, loanAmount, loanYears, annualRate, method, formatMoney]);

  /** 统计卡片 */
  const statCards = result
    ? [
        {
          label: method === 'equal-payment' ? '每月月供' : '首月月供',
          value: formatMoney(result.firstMonthPayment),
          unit: '元',
          icon: DollarSign,
          color: 'text-primary',
          bg: 'bg-primary/10',
        },
        {
          label: '总还款额',
          value: formatMoney(result.totalPayment),
          unit: '元',
          icon: TrendingUp,
          color: 'text-info',
          bg: 'bg-info/10',
        },
        {
          label: '支付利息',
          value: formatMoney(result.totalInterest),
          unit: '元',
          icon: Percent,
          color: 'text-warning',
          bg: 'bg-warning/10',
        },
        {
          label: '还款期数',
          value: result.totalMonths.toString(),
          unit: '期',
          icon: Calendar,
          color: 'text-success',
          bg: 'bg-success/10',
        },
      ]
    : [];

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
              <Home className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">房贷计算器</h1>
            <p className="text-sm text-muted-foreground">
              支持等额本息、等额本金两种还款方式，含还款明细表
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleCopy} disabled={!result} className="gap-2">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            复制结果
          </Button>
          <Button
            onClick={handleExport}
            size="sm"
            disabled={!result}
            className="gap-2 bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 shadow-md shadow-primary/20"
          >
            <Download className="h-4 w-4" />
            导出明细
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* 左侧：参数输入 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2 space-y-4"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                贷款参数
              </CardTitle>
              <CardDescription className="text-xs">
                输入贷款信息，实时计算还款明细
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* 还款方式 */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">还款方式</Label>
                <Tabs
                  value={method}
                  onValueChange={(v) => setMethod(v as 'equal-payment' | 'equal-principal')}
                  className="w-full"
                >
                  <TabsList className="w-full grid grid-cols-2 bg-muted/50">
                    <TabsTrigger value="equal-payment" className="text-sm">
                      等额本息
                    </TabsTrigger>
                    <TabsTrigger value="equal-principal" className="text-sm">
                      等额本金
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
                <p className="text-xs text-muted-foreground">
                  {method === 'equal-payment'
                    ? '每月还款金额相同，前期利息占比高，适合收入稳定者'
                    : '每月本金相同，月供逐月递减，总利息较少，适合前期还款能力强者'}
                </p>
              </div>

              {/* 贷款金额 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="amount" className="text-sm font-medium">
                    贷款金额
                  </Label>
                  <span className="text-xs text-muted-foreground">元</span>
                </div>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="amount"
                    type="number"
                    value={loanAmount}
                    onChange={(e) => setLoanAmount(e.target.value)}
                    placeholder="请输入贷款金额"
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[500000, 1000000, 2000000, 3000000].map((v) => (
                    <button
                      key={v}
                      onClick={() => setLoanAmount(v.toString())}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-md transition-colors',
                        loanAmount === v.toString()
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {(v / 10000).toFixed(0)}万
                    </button>
                  ))}
                </div>
              </div>

              {/* 贷款期限 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="years" className="text-sm font-medium">
                    贷款期限
                  </Label>
                  <span className="text-xs text-muted-foreground">年</span>
                </div>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="years"
                    type="number"
                    value={loanYears}
                    onChange={(e) => setLoanYears(e.target.value)}
                    placeholder="请输入贷款年限"
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[10, 15, 20, 25, 30].map((v) => (
                    <button
                      key={v}
                      onClick={() => setLoanYears(v.toString())}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-md transition-colors',
                        loanYears === v.toString()
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {v}年
                    </button>
                  ))}
                </div>
              </div>

              {/* 年利率 */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="rate" className="text-sm font-medium">
                    年利率
                  </Label>
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
                <div className="relative">
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="rate"
                    type="number"
                    step="0.01"
                    value={annualRate}
                    onChange={(e) => setAnnualRate(e.target.value)}
                    placeholder="请输入年利率"
                    className="pl-10 bg-background/50 border-border/50 focus:border-primary/50"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  {[3.1, 3.85, 4.2, 4.9, 5.88].map((v) => (
                    <button
                      key={v}
                      onClick={() => setAnnualRate(v.toString())}
                      className={cn(
                        'px-2.5 py-1 text-xs rounded-md transition-colors',
                        annualRate === v.toString()
                          ? 'bg-primary/15 text-primary font-medium'
                          : 'bg-muted/50 text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {v}%
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：计算结果 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="lg:col-span-3 space-y-4"
        >
          {/* 结果卡片 */}
          {result ? (
            <div className="grid grid-cols-2 gap-3">
              {statCards.map((card, i) => {
                const Icon = card.icon;
                return (
                  <motion.div
                    key={card.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.2 + i * 0.05 }}
                  >
                    <Card className="h-full border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={cn('flex items-center justify-center w-10 h-10 rounded-lg shrink-0', card.bg)}>
                            <Icon className={cn('h-5 w-5', card.color)} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
                            <div className="text-lg md:text-xl font-bold text-foreground tabular-nums truncate">
                              {card.value}
                              <span className="text-xs font-normal text-muted-foreground ml-1">{card.unit}</span>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
              <CardContent className="p-8 text-center">
                <Calculator className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-muted-foreground text-sm">请输入贷款参数查看计算结果</p>
              </CardContent>
            </Card>
          )}

          {/* 利息占比可视化 */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 }}
            >
              <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold">还款构成</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="h-4 rounded-full bg-muted overflow-hidden flex">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(parseFloat(loanAmount) / result.totalPayment) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.5, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-primary to-primary/70"
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(result.totalInterest / result.totalPayment) * 100}%` }}
                      transition={{ duration: 0.8, delay: 0.6, ease: 'easeOut' }}
                      className="h-full bg-gradient-to-r from-warning to-warning/70"
                    />
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-muted-foreground">本金</span>
                      <span className="font-medium tabular-nums">
                        {((parseFloat(loanAmount) / result.totalPayment) * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-warning" />
                      <span className="text-muted-foreground">利息</span>
                      <span className="font-medium tabular-nums">
                        {((result.totalInterest / result.totalPayment) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* 还款明细表 */}
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.45 }}
            >
              <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
                <CardHeader
                  className="pb-3 cursor-pointer select-none"
                  onClick={() => setShowSchedule(!showSchedule)}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      还款明细表
                      <Badge variant="outline" className="text-xs font-normal ml-1">
                        共 {result.totalMonths} 期
                      </Badge>
                    </CardTitle>
                    <Button variant="ghost" size="icon" className="h-7 w-7">
                      {showSchedule ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </CardHeader>
                {showSchedule && (
                  <CardContent className="pt-0 p-0">
                    <div className="border-t border-border/30 max-h-[400px] overflow-auto">
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                          <tr>
                            <th className="px-4 py-2.5 text-left font-medium text-muted-foreground text-xs whitespace-nowrap">
                              期次
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs whitespace-nowrap">
                              月供(元)
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs whitespace-nowrap">
                              本金(元)
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs whitespace-nowrap">
                              利息(元)
                            </th>
                            <th className="px-4 py-2.5 text-right font-medium text-muted-foreground text-xs whitespace-nowrap">
                              剩余本金(元)
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.schedule.map((item: MortgagePaymentItem) => (
                             <tr key={item.period} className="border-b border-border/20 hover:bg-muted/30">
                               <td className="px-4 py-2 text-foreground tabular-nums">
                                 第 {item.period} 期
                               </td>
                               <td className="px-4 py-2 text-right font-medium text-foreground tabular-nums">
                                 {formatMoney(item.monthlyPayment)}
                               </td>
                               <td className="px-4 py-2 text-right text-primary tabular-nums">
                                 {formatMoney(item.principal)}
                               </td>
                               <td className="px-4 py-2 text-right text-warning tabular-nums">
                                 {formatMoney(item.interest)}
                               </td>
                               <td className="px-4 py-2 text-right text-muted-foreground tabular-nums">
                                 {formatMoney(item.remainingPrincipal)}
                               </td>
                             </tr>
                           ))}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                )}
              </Card>
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* 试用版提示 */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版</div>
            <div className="text-xs text-muted-foreground">
              试用版导出的还款明细含试用水印。激活后解锁全部功能，去水印。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
