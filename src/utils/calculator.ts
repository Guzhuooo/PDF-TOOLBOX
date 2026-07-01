/**
 * 科学计算器工具函数集
 * 所有计算均在浏览器本地完成，不涉及后端服务器
 * 支持：基础运算、科学函数（三角/反三角/对数/指数/开方/阶乘）、常量、历史记录
 */

import { logger } from '@lark-apaas/client-toolkit-lite';

/** ============================================================
 *  类型定义
 * ============================================================ */

/** 计算历史记录项 */
export interface CalcHistoryItem {
  /** 唯一 ID */
  id: string;
  /** 表达式字符串（展示用） */
  expression: string;
  /** 计算结果 */
  result: string;
  /** 时间戳 */
  timestamp: number;
}

/** 角度模式：角度/弧度 */
export type AngleMode = 'deg' | 'rad';

/** 计算引擎状态 */
export interface CalcState {
  /** 当前显示值 */
  display: string;
  /** 待计算表达式（中缀） */
  expression: string;
  /** 上一个操作数 */
  previousValue: string | null;
  /** 当前运算符 */
  operator: string | null;
  /** 是否等待新操作数输入 */
  waitingForOperand: boolean;
  /** 角度模式 */
  angleMode: AngleMode;
  /** 历史记录 */
  history: CalcHistoryItem[];
  /** 是否错误状态 */
  isError: boolean;
}

/** ============================================================
 *  常量
 * ============================================================ */

/** 数学常量 */
export const MATH_CONSTANTS = {
  PI: Math.PI,
  E: Math.E,
} as const;

/** 最大历史记录条数 */
const MAX_HISTORY = 50;

/** ============================================================
 *  角度转换辅助
 * ============================================================ */

/** 角度转弧度 */
function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** 弧度转角度 */
function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** ============================================================
 *  科学函数计算（支持角度模式）
 * ============================================================ */

/**
 * 计算三角函数值
 * @param fn 函数名
 * @param value 输入值
 * @param angleMode 角度模式
 */
export function calcTrig(
  fn: 'sin' | 'cos' | 'tan' | 'asin' | 'acos' | 'atan',
  value: number,
  angleMode: AngleMode = 'rad',
): number {
  const rad = angleMode === 'deg' ? degToRad(value) : value;
  switch (fn) {
    case 'sin':
      return Math.sin(rad);
    case 'cos':
      return Math.cos(rad);
    case 'tan':
      return Math.tan(rad);
    case 'asin': {
      const result = Math.asin(value);
      return angleMode === 'deg' ? radToDeg(result) : result;
    }
    case 'acos': {
      const result = Math.acos(value);
      return angleMode === 'deg' ? radToDeg(result) : result;
    }
    case 'atan': {
      const result = Math.atan(value);
      return angleMode === 'deg' ? radToDeg(result) : result;
    }
  }
}

/**
 * 计算对数
 * @param base 底数：'ln'=自然对数 / 'log10'=常用对数 / 数字=自定义底数
 */
export function calcLog(value: number, base: number | 'ln' | 'log10' = 'ln'): number {
  if (value <= 0) return NaN;
  if (base === 'ln') return Math.log(value);
  if (base === 'log10') return Math.log10(value);
  return Math.log(value) / Math.log(base);
}

/**
 * 计算指数/幂
 */
export function calcPower(base: number, exponent: number): number {
  return Math.pow(base, exponent);
}

/**
 * 计算平方根
 */
export function calcSqrt(value: number): number {
  if (value < 0) return NaN;
  return Math.sqrt(value);
}

/**
 * 计算立方根
 */
export function calcCbrt(value: number): number {
  return Math.cbrt(value);
}

/**
 * 计算阶乘（支持 0! = 1，仅非负整数）
 */
export function calcFactorial(n: number): number {
  if (n < 0 || !Number.isInteger(n)) return NaN;
  if (n > 170) return Infinity; // 防止溢出
  if (n === 0 || n === 1) return 1;
  let result = 1;
  for (let i = 2; i <= n; i++) {
    result *= i;
  }
  return result;
}

/**
 * 计算倒数
 */
export function calcReciprocal(value: number): number {
  if (value === 0) return NaN;
  return 1 / value;
}

/**
 * 计算百分比
 */
export function calcPercent(value: number): number {
  return value / 100;
}

/**
 * 取绝对值
 */
export function calcAbs(value: number): number {
  return Math.abs(value);
}

/**
 * 取反
 */
export function calcNegate(value: number): number {
  return -value;
}

/** ============================================================
 *  表达式解析与计算（中缀 → 后缀 → 求值，Shunting-yard 算法）
 * ============================================================ */

/** 运算符优先级 */
const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '^': 3,
  '%': 2,
};

/** 右结合运算符 */
const RIGHT_ASSOCIATIVE = new Set(['^']);

/**
 * 中缀表达式转后缀（逆波兰）表达式
 * 支持 + - * / ^ % 以及括号
 */
export function infixToPostfix(tokens: string[]): string[] {
  const output: string[] = [];
  const ops: string[] = [];

  for (const token of tokens) {
    // 数字
    if (!isNaN(parseFloat(token)) && isFinite(Number(token))) {
      output.push(token);
    }
    // 左括号
    else if (token === '(') {
      ops.push(token);
    }
    // 右括号
    else if (token === ')') {
      while (ops.length > 0 && ops[ops.length - 1] !== '(') {
        output.push(ops.pop()!);
      }
      ops.pop(); // 弹出左括号
    }
    // 运算符
    else if (token in PRECEDENCE) {
      while (
        ops.length > 0 &&
        ops[ops.length - 1] !== '(' &&
        ((RIGHT_ASSOCIATIVE.has(token) &&
          PRECEDENCE[ops[ops.length - 1]] > PRECEDENCE[token]) ||
          (!RIGHT_ASSOCIATIVE.has(token) &&
            PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[token]))
      ) {
        output.push(ops.pop()!);
      }
      ops.push(token);
    }
  }

  while (ops.length > 0) {
    output.push(ops.pop()!);
  }

  return output;
}

/**
 * 将表达式字符串拆分为 token 数组
 * 支持数字（含小数）、运算符、括号、π、e
 */
export function tokenize(expr: string): string[] {
  const tokens: string[] = [];
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];

    // 跳过空格
    if (ch === ' ') {
      i++;
      continue;
    }

    // 数字（含小数）
    if (/[0-9.]/.test(ch)) {
      let num = '';
      while (i < expr.length && /[0-9.]/.test(expr[i])) {
        num += expr[i];
        i++;
      }
      tokens.push(num);
      continue;
    }

    // 常量 π
    if (ch === 'π' || ch === 'pi' || (ch === 'p' && expr[i + 1] === 'i')) {
      tokens.push(String(Math.PI));
      i += ch === 'p' ? 2 : 1;
      continue;
    }

    // 常量 e
    if (ch === 'e' && (i === 0 || !/[a-zA-Z]/.test(expr[i - 1]))) {
      tokens.push(String(Math.E));
      i++;
      continue;
    }

    // 运算符 / 括号
    if ('+-*/^%()'.includes(ch)) {
      // 处理负号（开头或左括号后）
      if (ch === '-' && (tokens.length === 0 || tokens[tokens.length - 1] === '(')) {
        tokens.push('0');
      }
      tokens.push(ch);
      i++;
      continue;
    }

    i++;
  }

  return tokens;
}

/**
 * 计算后缀表达式
 */
export function evaluatePostfix(postfix: string[]): number {
  const stack: number[] = [];

  for (const token of postfix) {
    const num = parseFloat(token);
    if (!isNaN(num) && isFinite(num)) {
      stack.push(num);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return NaN;

      switch (token) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          if (b === 0) return NaN;
          stack.push(a / b);
          break;
        case '^':
          stack.push(Math.pow(a, b));
          break;
        case '%':
          stack.push(a % b);
          break;
        default:
          return NaN;
      }
    }
  }

  return stack.length === 1 ? stack[0] : NaN;
}

/**
 * 计算中缀表达式
 * @param expr 表达式字符串，如 "2+3*4"
 */
export function calculateExpression(expr: string): number {
  try {
    const tokens = tokenize(expr);
    if (tokens.length === 0) return 0;
    const postfix = infixToPostfix(tokens);
    const result = evaluatePostfix(postfix);
    return result;
  } catch (error) {
    logger.error('Calculate expression failed:', String(error));
    return NaN;
  }
}

/** ============================================================
 *  历史记录管理
 * ============================================================ */

/**
 * 添加历史记录
 */
export function addHistory(
  history: CalcHistoryItem[],
  expression: string,
  result: string,
): CalcHistoryItem[] {
  const item: CalcHistoryItem = {
    id: `calc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    expression,
    result,
    timestamp: Date.now(),
  };
  const newHistory = [item, ...history];
  if (newHistory.length > MAX_HISTORY) {
    return newHistory.slice(0, MAX_HISTORY);
  }
  return newHistory;
}

/**
 * 清空历史记录
 */
export function clearHistory(): CalcHistoryItem[] {
  return [];
}

/**
 * 删除单条历史记录
 */
export function removeHistoryItem(history: CalcHistoryItem[], id: string): CalcHistoryItem[] {
  return history.filter((item) => item.id !== id);
}

/** ============================================================
 *  数字格式化
 * ============================================================ */

/**
 * 格式化计算结果（避免浮点数精度问题）
 */
export function formatResult(value: number): string {
  if (!isFinite(value)) return 'Error';
  if (isNaN(value)) return 'Error';

  // 整数直接返回
  if (Number.isInteger(value)) {
    return String(value);
  }

  // 浮点数：保留最多 12 位有效数字，去掉末尾多余 0
  const formatted = parseFloat(value.toPrecision(12)).toString();
  return formatted;
}

/**
 * 格式化显示数字（加千分位）
 */
export function formatDisplay(value: string): string {
  if (value === 'Error' || value === '') return value;
  const num = parseFloat(value);
  if (isNaN(num)) return value;

  // 大数/小数用科学计数法
  if (Math.abs(num) >= 1e15 || (Math.abs(num) < 1e-6 && num !== 0)) {
    return num.toExponential(6);
  }

  // 整数加千分位
  if (Number.isInteger(num)) {
    return num.toLocaleString('en-US');
  }

  // 小数：整数部分加千分位
  const parts = value.split('.');
  const intPart = parseInt(parts[0], 10);
  const decPart = parts[1] || '';
  return `${intPart.toLocaleString('en-US')}${decPart ? '.' + decPart : ''}`;
}

/** ============================================================
 *  单步计算器状态机（按钮式计算器）
 * ============================================================ */

/** 创建初始状态 */
export function createInitialState(): CalcState {
  return {
    display: '0',
    expression: '',
    previousValue: null,
    operator: null,
    waitingForOperand: false,
    angleMode: 'deg',
    history: [],
    isError: false,
  };
}

/**
 * 输入数字
 */
export function inputDigit(state: CalcState, digit: string): CalcState {
  if (state.isError) {
    return { ...state, display: digit, isError: false, waitingForOperand: false };
  }

  if (state.waitingForOperand) {
    return { ...state, display: digit, waitingForOperand: false };
  }

  if (state.display === '0') {
    return { ...state, display: digit };
  }

  // 限制最大长度
  if (state.display.replace(/[.-]/g, '').length >= 16) {
    return state;
  }

  return { ...state, display: state.display + digit };
}

/**
 * 输入小数点
 */
export function inputDecimal(state: CalcState): CalcState {
  if (state.isError) {
    return { ...state, display: '0.', isError: false, waitingForOperand: false };
  }

  if (state.waitingForOperand) {
    return { ...state, display: '0.', waitingForOperand: false };
  }

  if (state.display.includes('.')) {
    return state;
  }

  return { ...state, display: state.display + '.' };
}

/**
 * 清除操作
 * @param mode 'AC' 全部清除 / 'CE' 清除当前输入 / 'backspace' 退格
 */
export function clearInput(state: CalcState, mode: 'AC' | 'CE' | 'backspace'): CalcState {
  switch (mode) {
    case 'AC':
      return {
        ...state,
        display: '0',
        expression: '',
        previousValue: null,
        operator: null,
        waitingForOperand: false,
        isError: false,
      };
    case 'CE':
      return {
        ...state,
        display: '0',
        waitingForOperand: false,
        isError: false,
      };
    case 'backspace':
      if (state.isError || state.waitingForOperand) return state;
      if (state.display.length <= 1 || (state.display.length === 2 && state.display.startsWith('-'))) {
        return { ...state, display: '0' };
      }
      return { ...state, display: state.display.slice(0, -1) };
  }
}

/**
 * 输入运算符
 */
export function inputOperator(state: CalcState, op: string): CalcState {
  if (state.isError) return state;

  const currentValue = parseFloat(state.display);

  // 已有运算符且不是等待操作数：先计算上一步
  if (state.operator && !state.waitingForOperand && state.previousValue !== null) {
    const prev = parseFloat(state.previousValue);
    let result = 0;
    switch (state.operator) {
      case '+':
        result = prev + currentValue;
        break;
      case '-':
        result = prev - currentValue;
        break;
      case '×':
      case '*':
        result = prev * currentValue;
        break;
      case '÷':
      case '/':
        if (currentValue === 0) {
          return { ...state, display: 'Error', isError: true };
        }
        result = prev / currentValue;
        break;
      case '^':
        result = Math.pow(prev, currentValue);
        break;
      default:
        result = currentValue;
    }
    const formatted = formatResult(result);
    return {
      ...state,
      display: formatted,
      previousValue: formatted,
      operator: op,
      waitingForOperand: true,
      expression: `${state.previousValue} ${state.operator} ${state.display} =`,
    };
  }

  return {
    ...state,
    previousValue: state.display,
    operator: op,
    waitingForOperand: true,
    expression: `${state.display} ${op}`,
  };
}

/**
 * 执行等号计算
 */
export function calculateEquals(state: CalcState): CalcState {
  if (state.isError || state.operator === null || state.previousValue === null) {
    return state;
  }

  const prev = parseFloat(state.previousValue);
  const current = parseFloat(state.display);
  let result = 0;

  switch (state.operator) {
    case '+':
      result = prev + current;
      break;
    case '-':
      result = prev - current;
      break;
    case '×':
    case '*':
      result = prev * current;
      break;
    case '÷':
    case '/':
      if (current === 0) {
        return { ...state, display: 'Error', isError: true };
      }
      result = prev / current;
      break;
    case '^':
      result = Math.pow(prev, current);
      break;
    default:
      result = current;
  }

  const formatted = formatResult(result);
  const expression = `${state.previousValue} ${state.operator} ${state.display}`;

  return {
    ...state,
    display: formatted,
    previousValue: null,
    operator: null,
    waitingForOperand: true,
    expression: `${expression} =`,
    history: addHistory(state.history, expression, formatted),
  };
}

/**
 * 执行一元科学函数
 */
export function applyUnaryFunction(
  state: CalcState,
  fn:
    | 'sin'
    | 'cos'
    | 'tan'
    | 'asin'
    | 'acos'
    | 'atan'
    | 'sqrt'
    | 'cbrt'
    | 'square'
    | 'cube'
    | 'ln'
    | 'log10'
    | 'factorial'
    | 'reciprocal'
    | 'percent'
    | 'abs'
    | 'negate',
): CalcState {
  if (state.isError) return state;

  const value = parseFloat(state.display);
  let result: number;

  switch (fn) {
    case 'sin':
    case 'cos':
    case 'tan':
    case 'asin':
    case 'acos':
    case 'atan':
      result = calcTrig(fn, value, state.angleMode);
      break;
    case 'sqrt':
      result = calcSqrt(value);
      break;
    case 'cbrt':
      result = calcCbrt(value);
      break;
    case 'square':
      result = value * value;
      break;
    case 'cube':
      result = value * value * value;
      break;
    case 'ln':
      result = calcLog(value, 'ln');
      break;
    case 'log10':
      result = calcLog(value, 'log10');
      break;
    case 'factorial':
      result = calcFactorial(value);
      break;
    case 'reciprocal':
      result = calcReciprocal(value);
      break;
    case 'percent':
      result = calcPercent(value);
      break;
    case 'abs':
      result = calcAbs(value);
      break;
    case 'negate':
      result = calcNegate(value);
      break;
  }

  const formatted = formatResult(result);
  const isErr = !isFinite(result) || isNaN(result);

  return {
    ...state,
    display: isErr ? 'Error' : formatted,
    isError: isErr,
    waitingForOperand: true,
  };
}

/**
 * 插入常量
 */
export function insertConstant(state: CalcState, constant: 'PI' | 'E'): CalcState {
  const value = constant === 'PI' ? String(Math.PI) : String(Math.E);
  return {
    ...state,
    display: value,
    waitingForOperand: false,
    isError: false,
  };
}

/**
 * 切换角度模式
 */
export function toggleAngleMode(state: CalcState): CalcState {
  return {
    ...state,
    angleMode: state.angleMode === 'deg' ? 'rad' : 'deg',
  };
}

/** 计算表达式（别名，兼容调用方命名） */
export function evaluateExpression(expr: string): number {
  return calculateExpression(expr);
}

/** 格式化数字（别名，兼容调用方命名） */
export function formatNumber(value: number): string {
  return formatResult(value);
}
