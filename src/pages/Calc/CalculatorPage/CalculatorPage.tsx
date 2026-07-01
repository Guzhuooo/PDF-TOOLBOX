import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calculator,
  History,
  Trash2,
  Copy,
  Check,
  Clock,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLicense } from '@/contexts/LicenseContext';
import {
  evaluateExpression,
  formatNumber,
  type HistoryItem,
} from '@/utils/calculator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

/** 计算器按钮配置 */
const BASIC_BUTTONS = [
  ['C', '⌫', '%', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '-'],
  ['1', '2', '3', '+'],
  ['0', '.', '='],
];

const SCIENTIFIC_BUTTONS = [
  ['sin', 'cos', 'tan', 'π'],
  ['sin⁻¹', 'cos⁻¹', 'tan⁻¹', 'e'],
  ['log', 'ln', '√', '³√'],
  ['x²', 'x³', 'xʸ', '!'],
  ['(', ')', '1/x', '|x|'],
];

export default function CalculatorPage() {
  const { isTrial } = useLicense();

  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [mode, setMode] = useState<'basic' | 'scientific'>('scientific');
  const [lastPressed, setLastPressed] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const displayRef = useRef<HTMLDivElement>(null);

  /** 追加到表达式 */
  const appendExpression = useCallback((value: string) => {
    setExpression((prev) => {
      // 运算符替换
      const ops = ['+', '-', '×', '÷'];
      if (ops.includes(value) && ops.includes(prev.slice(-1))) {
        return prev.slice(0, -1) + value;
      }
      return prev + value;
    });
    setLastPressed(value);
    setTimeout(() => setLastPressed(null), 150);
  }, []);

  /** 清除全部 */
  const clearAll = useCallback(() => {
    setExpression('');
    setResult('');
    setLastPressed('C');
    setTimeout(() => setLastPressed(null), 150);
  }, []);

  /** 退格 */
  const backspace = useCallback(() => {
    setExpression((prev) => prev.slice(0, -1));
    setLastPressed('⌫');
    setTimeout(() => setLastPressed(null), 150);
  }, []);

  /** 计算结果 */
  const calculate = useCallback(() => {
    if (!expression.trim()) return;
    try {
      const res = evaluateExpression(expression);
      const formatted = formatNumber(res);
      setResult(formatted);

      // 试用版不保存历史记录
      if (!isTrial) {
        setHistory((prev) => [
          { expression, result: formatted, timestamp: Date.now() },
          ...prev.slice(0, 49),
        ]);
      }
    } catch {
      setResult('错误');
    }
    setLastPressed('=');
    setTimeout(() => setLastPressed(null), 150);
  }, [expression, isTrial]);

  /** 处理科学函数 */
  const handleScientific = useCallback((func: string) => {
    setLastPressed(func);
    setTimeout(() => setLastPressed(null), 150);

    switch (func) {
      case 'sin':
      case 'cos':
      case 'tan':
        setExpression((prev) => prev + func + '(');
        break;
      case 'sin⁻¹':
        setExpression((prev) => prev + 'asin(');
        break;
      case 'cos⁻¹':
        setExpression((prev) => prev + 'acos(');
        break;
      case 'tan⁻¹':
        setExpression((prev) => prev + 'atan(');
        break;
      case 'log':
        setExpression((prev) => prev + 'log(');
        break;
      case 'ln':
        setExpression((prev) => prev + 'ln(');
        break;
      case '√':
        setExpression((prev) => prev + 'sqrt(');
        break;
      case '³√':
        setExpression((prev) => prev + 'cbrt(');
        break;
      case 'x²':
        setExpression((prev) => prev + '^2');
        break;
      case 'x³':
        setExpression((prev) => prev + '^3');
        break;
      case 'xʸ':
        setExpression((prev) => prev + '^');
        break;
      case '!':
        setExpression((prev) => prev + '!');
        break;
      case 'π':
        setExpression((prev) => prev + 'π');
        break;
      case 'e':
        setExpression((prev) => prev + 'e');
        break;
      case '1/x':
        setExpression((prev) => prev + '1/(');
        break;
      case '|x|':
        setExpression((prev) => prev + 'abs(');
        break;
      case '(':
      case ')':
        setExpression((prev) => prev + func);
        break;
    }
  }, []);

  /** 点击按钮 */
  const handleButtonClick = useCallback(
    (btn: string) => {
      if (btn === 'C') {
        clearAll();
      } else if (btn === '⌫') {
        backspace();
      } else if (btn === '=') {
        calculate();
      } else {
        appendExpression(btn);
      }
    },
    [clearAll, backspace, calculate, appendExpression],
  );

  /** 键盘输入 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key;

      // 数字和小数点
      if (/^[0-9.]$/.test(key)) {
        appendExpression(key);
        return;
      }

      // 运算符
      if (key === '+') {
        appendExpression('+');
        return;
      }
      if (key === '-') {
        appendExpression('-');
        return;
      }
      if (key === '*') {
        appendExpression('×');
        return;
      }
      if (key === '/') {
        e.preventDefault();
        appendExpression('÷');
        return;
      }

      // 括号
      if (key === '(' || key === ')') {
        appendExpression(key);
        return;
      }

      // 百分号
      if (key === '%') {
        appendExpression('%');
        return;
      }

      // 回车 = 计算
      if (key === 'Enter' || key === '=') {
        e.preventDefault();
        calculate();
        return;
      }

      // 退格
      if (key === 'Backspace') {
        backspace();
        return;
      }

      // Escape = 清除
      if (key === 'Escape') {
        clearAll();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [appendExpression, calculate, backspace, clearAll]);

  /** 复制结果 */
  const handleCopyResult = useCallback(async () => {
    if (!result || result === '错误') return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      toast.success('已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  }, [result]);

  /** 使用历史记录 */
  const useHistoryItem = useCallback((item: HistoryItem) => {
    setExpression(item.expression);
    setResult(item.result);
    setShowHistory(false);
    toast.success('已载入历史记录');
  }, []);

  /** 清空历史 */
  const clearHistory = useCallback(() => {
    setHistory([]);
    toast.success('历史记录已清空');
  }, []);

  /** 获取按钮样式 */
  const getButtonClass = (btn: string): string => {
    const isPressed = lastPressed === btn;

    // 等号按钮
    if (btn === '=') {
      return cn(
        'bg-gradient-to-r from-primary to-purple-600 text-white font-semibold shadow-md shadow-primary/20',
        isPressed && 'scale-95',
      );
    }
    // 运算符
    if (['÷', '×', '-', '+'].includes(btn)) {
      return cn(
        'bg-primary/10 text-primary font-semibold hover:bg-primary/20',
        isPressed && 'scale-95 bg-primary/20',
      );
    }
    // 清除/退格
    if (btn === 'C' || btn === '⌫') {
      return cn(
        'bg-destructive/10 text-destructive font-medium hover:bg-destructive/20',
        isPressed && 'scale-95',
      );
    }
    // 百分号
    if (btn === '%') {
      return cn(
        'bg-muted/50 text-foreground font-medium hover:bg-muted',
        isPressed && 'scale-95',
      );
    }
    // 数字
    return cn(
      'bg-background/80 text-foreground font-medium hover:bg-muted/50',
      isPressed && 'scale-95',
    );
  };

  /** 科学函数按钮样式 */
  const getSciButtonClass = (btn: string): string => {
    const isPressed = lastPressed === btn;
    if (btn === 'π' || btn === 'e') {
      return cn(
        'bg-accent text-accent-foreground font-semibold hover:bg-accent/80',
        isPressed && 'scale-95',
      );
    }
    return cn(
      'bg-background/60 text-foreground hover:bg-muted/50 text-sm',
      isPressed && 'scale-95',
    );
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
              <Calculator className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">科学计算器</h1>
            <p className="text-sm text-muted-foreground">
              支持基础运算、三角函数、对数、指数等科学函数
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="gap-2"
          >
            <History className="h-4 w-4" />
            历史记录
            {!isTrial && history.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 px-1.5">
                {history.length}
              </Badge>
            )}
          </Button>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 计算器主体 */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-lg dark:bg-slate-900/50 dark:border-white/10 overflow-hidden">
            {/* 显示区 */}
            <CardContent className="p-0">
              <div
                ref={displayRef}
                className="bg-gradient-to-br from-primary/5 via-background to-purple-500/5 dark:from-primary/10 dark:via-slate-900 dark:to-purple-900/20 p-6 border-b border-border/30"
              >
                {/* 表达式 */}
                <div className="text-right text-muted-foreground text-lg font-mono min-h-[28px] break-all">
                  {expression || <span className="text-muted-foreground/50">0</span>}
                </div>
                {/* 结果 */}
                <div className="text-right mt-2 flex items-end justify-end gap-3">
                  <div className="text-4xl md:text-5xl font-bold text-foreground font-mono break-all tabular-nums">
                    {result || '0'}
                  </div>
                  {result && result !== '错误' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleCopyResult}
                      className="h-8 w-8 shrink-0 mb-1"
                      title="复制结果"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-success" style={{ color: 'hsl(130 54% 42%)' }} />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>

              {/* 模式切换 */}
              <div className="px-4 pt-4">
                <Tabs
                  value={mode}
                  onValueChange={(v) => setMode(v as 'basic' | 'scientific')}
                >
                  <TabsList className="bg-muted/50 w-full">
                    <TabsTrigger value="basic" className="flex-1">基础</TabsTrigger>
                    <TabsTrigger value="scientific" className="flex-1">科学</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* 按钮区 */}
              <div className="p-4 space-y-3">
                {/* 科学函数区 */}
                <AnimatePresence mode="wait">
                  {mode === 'scientific' && (
                    <motion.div
                      key="scientific"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25 }}
                      className="grid grid-cols-4 gap-2 overflow-hidden"
                    >
                      {SCIENTIFIC_BUTTONS.flat().map((btn) => (
                        <button
                          key={btn}
                          onClick={() => handleScientific(btn)}
                          className={cn(
                            'h-12 rounded-lg transition-all duration-150 active:scale-95',
                            getSciButtonClass(btn),
                          )}
                        >
                          {btn}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* 基础按钮区 */}
                <div className="grid grid-cols-4 gap-2">
                  {BASIC_BUTTONS.map((row, rowIdx) =>
                    row.map((btn) => {
                      const isZero = btn === '0';
                      return (
                        <motion.button
                          key={btn}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={() => handleButtonClick(btn)}
                          className={cn(
                            'h-14 rounded-lg text-lg transition-all duration-100',
                            isZero && 'col-span-2',
                            getButtonClass(btn),
                          )}
                        >
                          {btn}
                        </motion.button>
                      );
                    }),
                  )}
                </div>

                {/* 键盘提示 */}
                <div className="text-center text-xs text-muted-foreground pt-2">
                  💡 支持键盘输入：数字、运算符、Enter 计算、Backspace 退格、Esc 清除
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* 右侧：历史记录 / 说明 */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-4"
        >
          {/* 历史记录面板 */}
          <AnimatePresence mode="wait">
            {showHistory && (
              <motion.div
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.25 }}
              >
                <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
                  <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" />
                      计算历史
                    </CardTitle>
                    {history.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearHistory}
                        className="h-8 px-2 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    {isTrial ? (
                      <div className="text-center py-8">
                        <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mx-auto mb-3">
                          <Sparkles className="h-6 w-6 text-warning" />
                        </div>
                        <div className="text-sm font-medium text-foreground mb-1">试用版功能</div>
                        <div className="text-xs text-muted-foreground">
                          试用版不保存历史记录，激活后解锁完整功能
                        </div>
                      </div>
                    ) : history.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        暂无历史记录
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px] pr-2">
                        <div className="space-y-2">
                          {history.map((item, idx) => (
                            <motion.button
                              key={idx}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.2, delay: idx * 0.02 }}
                              onClick={() => useHistoryItem(item)}
                              className="w-full text-left p-3 rounded-lg bg-muted/30 hover:bg-primary/10 border border-transparent hover:border-primary/20 transition-all group"
                            >
                              <div className="text-xs text-muted-foreground truncate font-mono">
                                {item.expression}
                              </div>
                              <div className="text-lg font-semibold text-foreground font-mono tabular-nums truncate mt-0.5">
                                = {item.result}
                              </div>
                            </motion.button>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 功能说明 */}
          <Card className="border border-white/20 bg-white/60 backdrop-blur-xl shadow-md dark:bg-slate-900/50 dark:border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">功能说明</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                <div>
                  <div className="font-medium text-foreground">基础运算</div>
                  <div className="text-xs text-muted-foreground">加减乘除、百分号、小数运算</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-info mt-1.5 shrink-0" />
                <div>
                  <div className="font-medium text-foreground">科学函数</div>
                  <div className="text-xs text-muted-foreground">
                    三角函数、反三角函数、对数、指数、开方、阶乘
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-success mt-1.5 shrink-0" style={{ background: 'hsl(130 54% 42%)' }} />
                <div>
                  <div className="font-medium text-foreground">常量支持</div>
                  <div className="text-xs text-muted-foreground">π (圆周率)、e (自然常数)</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-warning mt-1.5 shrink-0" />
                <div>
                  <div className="font-medium text-foreground">键盘输入</div>
                  <div className="text-xs text-muted-foreground">
                    支持数字键、运算符、Enter 计算、Backspace 退格
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

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
                  试用版不保存计算历史记录。激活后解锁完整功能。
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
