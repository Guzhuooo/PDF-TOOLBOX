import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ruler,
  Scale,
  Square,
  Box,
  Thermometer,
  Clock,
  HardDrive,
  Gauge,
  ArrowRightLeft,
  Copy,
  Check,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import {
  getCategoryList,
  convert,
  type UnitCategory,
  type CategoryDef,
} from '@/utils/unit-converter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

/** 类别图标映射 */
const CATEGORY_ICONS: Record<UnitCategory, typeof Ruler> = {
  length: Ruler,
  weight: Scale,
  area: Square,
  volume: Box,
  temperature: Thermometer,
  time: Clock,
  data: HardDrive,
  speed: Gauge,
};

/** 试用版开放的类别 */
const TRIAL_CATEGORIES: UnitCategory[] = ['length', 'weight', 'temperature'];

export default function UnitConverterPage() {
  const { isTrial } = useLicense();
  const categories = getCategoryList();

  // 当前选中的类别
  const [activeCategory, setActiveCategory] = useState<UnitCategory>('length');
  // 当前输入的单位 key
  const [fromUnit, setFromUnit] = useState<string>('');
  // 当前输入的值
  const [inputValue, setInputValue] = useState<string>('1');
  // 复制状态
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // 当前类别数据
  const currentCategory = useMemo<CategoryDef | undefined>(
    () => categories.find((c) => c.key === activeCategory),
    [categories, activeCategory],
  );

  // 初始化默认 fromUnit
  useMemo(() => {
    if (currentCategory && !fromUnit) {
      setFromUnit(currentCategory.baseUnit);
    }
  }, [currentCategory, fromUnit]);

  /** 计算所有单位的换算结果 */
  const results = useMemo(() => {
    if (!currentCategory || !inputValue || inputValue === '-' || inputValue === '.') {
      return [];
    }
    const numValue = parseFloat(inputValue);
    if (isNaN(numValue)) return [];

    return currentCategory.units.map((unit) => {
      const converted = convert(numValue, fromUnit, unit.key, activeCategory);
      return {
        key: unit.key,
        name: unit.name,
        symbol: unit.symbol,
        value: converted,
      };
    });
  }, [currentCategory, inputValue, fromUnit, activeCategory]);

  /** 选择某个单位作为输入源 */
  const handleSelectUnit = useCallback((unitKey: string, value: number) => {
    setFromUnit(unitKey);
    // 格式化显示值
    const formatted = formatNumber(value);
    setInputValue(formatted);
  }, []);

  /** 输入值变化 */
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    // 允许空、负号、小数点
    if (val === '' || val === '-' || val === '.' || val === '-.') {
      setInputValue(val);
      return;
    }
    // 校验数字格式
    if (/^-?\d*\.?\d*$/.test(val)) {
      setInputValue(val);
    }
  }, []);

  /** 复制结果 */
  const handleCopy = useCallback(async (value: number, symbol: string, key: string) => {
    const text = `${formatNumber(value)} ${symbol}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopiedKey(null), 1500);
    } catch {
      toast.error('复制失败');
    }
  }, []);

  /** 重置 */
  const handleReset = useCallback(() => {
    setInputValue('1');
    if (currentCategory) {
      setFromUnit(currentCategory.baseUnit);
    }
  }, [currentCategory]);

  /** 切换类别 */
  const handleCategoryChange = useCallback((cat: UnitCategory) => {
    if (isTrial && !TRIAL_CATEGORIES.includes(cat)) {
      toast.warning('试用版仅开放长度、重量、温度三类换算，激活后解锁全部功能');
      return;
    }
    setActiveCategory(cat);
    const catData = categories.find((c) => c.key === cat);
    if (catData) {
      setFromUnit(catData.baseUnit);
    }
    setInputValue('1');
  }, [isTrial, categories]);

  /** 格式化数字 */
  function formatNumber(num: number): string {
    if (num === 0) return '0';
    if (Math.abs(num) >= 1e12 || (Math.abs(num) < 0.000001 && num !== 0)) {
      return num.toExponential(6);
    }
    // 保留最多8位有效数字，去除末尾0
    const fixed = num.toPrecision(10);
    const parsed = parseFloat(fixed);
    return parsed.toString();
  }

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
              <ArrowRightLeft className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">单位换算</h1>
            <p className="text-sm text-muted-foreground">
              8 大类单位实时双向换算，输入一个值其他自动更新
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
              试用版 · 开放 3 类
            </Badge>
          )}
        </div>
      </motion.div>

      {/* 类别 Tab */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardContent className="p-2">
            <Tabs value={activeCategory} onValueChange={(v) => handleCategoryChange(v as UnitCategory)}>
              <TabsList className="w-full bg-muted/30 p-1 grid grid-cols-4 md:grid-cols-8 h-auto">
                {categories.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.key];
                  const locked = isTrial && !TRIAL_CATEGORIES.includes(cat.key);
                  return (
                    <TabsTrigger
                      key={cat.key}
                      value={cat.key}
                      className={cn(
                        'flex flex-col items-center gap-1 py-2 px-1 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm',
                        locked && 'opacity-50',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="truncate w-full text-center">{cat.name}</span>
                    </TabsTrigger>
                  );
                })}
              </TabsList>
            </Tabs>
          </CardContent>
        </Card>
      </motion.div>

      {/* 输入区 */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
      >
        <Card className="border border-white/20 bg-gradient-to-br from-primary/10 via-white/60 to-purple-500/10 backdrop-blur-xl shadow-lg dark:from-primary/20 dark:via-slate-900/50 dark:to-purple-500/20 dark:border-white/10">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-end gap-4">
              <div className="flex-1 space-y-2">
                <label className="text-sm text-muted-foreground">输入数值</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={inputValue}
                  onChange={handleInputChange}
                  placeholder="输入数值..."
                  className="h-14 text-2xl font-semibold bg-white/70 dark:bg-slate-800/50 border-border/50 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="md:w-48 space-y-2">
                <label className="text-sm text-muted-foreground">单位</label>
                <div className="h-14 px-4 rounded-lg bg-white/70 dark:bg-slate-800/50 border border-border/50 flex items-center justify-between">
                  <span className="font-medium text-foreground">
                    {currentCategory?.units.find((u) => u.key === fromUnit)?.name}
                  </span>
                  <span className="text-sm text-muted-foreground font-mono">
                    {currentCategory?.units.find((u) => u.key === fromUnit)?.symbol}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 换算结果 */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              换算结果
            </CardTitle>
            <CardDescription className="text-xs">
              共 {currentCategory?.units.length ?? 0} 个单位 · 点击任意单位设为基准
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <AnimatePresence mode="popLayout">
                {results.map((item, i) => {
                  const isFrom = item.key === fromUnit;
                  return (
                    <motion.div
                      key={item.key}
                      layout
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2, delay: i * 0.02 }}
                    >
                      <div
                        className={cn(
                          'group relative rounded-xl border p-4 transition-all cursor-pointer',
                          'hover:shadow-md hover:-translate-y-0.5',
                          isFrom
                            ? 'border-primary/50 bg-primary/5 shadow-sm'
                            : 'border-border/50 bg-white/50 dark:bg-slate-800/30 hover:border-primary/30',
                        )}
                        onClick={() => handleSelectUnit(item.key, item.value)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm text-muted-foreground mb-1">
                              {item.name}
                              {isFrom && (
                                <Badge variant="secondary" className="ml-2 text-[10px] h-4 px-1.5">
                                  基准
                                </Badge>
                              )}
                            </div>
                            <div className="text-xl font-semibold text-foreground font-mono tabular-nums truncate">
                              {formatNumber(item.value)}
                            </div>
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {item.symbol}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(item.value, item.symbol, item.key);
                            }}
                            title="复制"
                          >
                            {copiedKey === item.key ? (
                              <Check className="h-4 w-4 text-success" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 试用版提示 */}
      {isTrial && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="rounded-xl border border-warning/30 bg-warning/10 p-4 flex items-center gap-3"
        >
          <div className="shrink-0 w-10 h-10 rounded-lg bg-warning/20 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-warning" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground">试用版限制</div>
            <div className="text-xs text-muted-foreground">
              试用版仅开放长度、重量、温度 3 类单位换算。激活后解锁全部 8 大类单位及更多功能。
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
