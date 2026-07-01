/**
 * 房贷计算工具函数
 * 支持等额本息、等额本金两种还款方式
 * 所有计算均在浏览器本地完成，不涉及后端服务器
 */

/** ============================================================
 *  类型定义
 * ============================================================ */

/** 还款方式 */
export type MortgageType = 'equal-principal-interest' | 'equal-principal';

/** 单月还款明细 */
export interface MortgagePaymentItem {
  /** 第几期 */
  period: number;
  /** 月供（元） */
  monthlyPayment: number;
  /** 本金（元） */
  principal: number;
  /** 利息（元） */
  interest: number;
  /** 剩余本金（元） */
  remainingPrincipal: number;
}

/** 房贷计算结果 */
export interface MortgageResult {
  /** 还款方式 */
  type: MortgageType;
  /** 贷款总额（元） */
  loanAmount: number;
  /** 贷款期限（月） */
  totalMonths: number;
  /** 年利率（%） */
  annualRate: number;
  /** 月利率 */
  monthlyRate: number;
  /** 总还款额（元） */
  totalPayment: number;
  /** 总利息（元） */
  totalInterest: number;
  /** 首月月供（元） */
  firstMonthPayment: number;
  /** 末月月供（元） */
  lastMonthPayment: number;
  /** 每月还款明细 */
  schedule: MortgagePaymentItem[];
}

/** 房贷计算输入参数 */
export interface MortgageParams {
  /** 贷款总额（元） */
  loanAmount: number;
  /** 贷款期限（年） */
  years: number;
  /** 年利率（%） */
  annualRate: number;
  /** 还款方式 */
  type: MortgageType;
}

/** ============================================================
 *  工具函数
 * ============================================================ */

/**
 * 格式化金额，保留两位小数
 */
export function formatMoney(amount: number): string {
  return amount.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * 格式化金额为万元单位
 */
export function formatWan(amount: number): string {
  return (amount / 10000).toFixed(2);
}

/**
 * 月利率 = 年利率 / 12 / 100
 */
function getMonthlyRate(annualRate: number): number {
  return annualRate / 12 / 100;
}

/** ============================================================
 *  等额本息计算
 *
 *  公式：
 *  月供 = 贷款本金 × [月利率 × (1+月利率)^还款月数] / [(1+月利率)^还款月数 - 1]
 *  每月利息 = 剩余本金 × 月利率
 *  每月本金 = 月供 - 每月利息
 * ============================================================ */

/**
 * 等额本息计算
 */
export function calcEqualPrincipalInterest(params: MortgageParams): MortgageResult {
  const { loanAmount, years, annualRate } = params;
  const totalMonths = Math.round(years * 12);
  const monthlyRate = getMonthlyRate(annualRate);

  // 月供
  let monthlyPayment: number;
  if (monthlyRate === 0) {
    monthlyPayment = loanAmount / totalMonths;
  } else {
    const pow = Math.pow(1 + monthlyRate, totalMonths);
    monthlyPayment = (loanAmount * monthlyRate * pow) / (pow - 1);
  }

  const schedule: MortgagePaymentItem[] = [];
  let remaining = loanAmount;
  let totalInterest = 0;

  for (let i = 1; i <= totalMonths; i++) {
    const interest = remaining * monthlyRate;
    const principal = monthlyPayment - interest;
    remaining -= principal;
    // 最后一期修正浮点误差
    if (i === totalMonths) {
      remaining = 0;
    }
    totalInterest += interest;

    schedule.push({
      period: i,
      monthlyPayment,
      principal,
      interest,
      remainingPrincipal: Math.max(0, remaining),
    });
  }

  const totalPayment = loanAmount + totalInterest;

  return {
    type: 'equal-principal-interest',
    loanAmount,
    totalMonths,
    annualRate,
    monthlyRate,
    totalPayment,
    totalInterest,
    firstMonthPayment: monthlyPayment,
    lastMonthPayment: monthlyPayment,
    schedule,
  };
}

/** ============================================================
 *  等额本金计算
 *
 *  公式：
 *  每月本金 = 贷款本金 / 还款月数
 *  每月利息 = 剩余本金 × 月利率
 *  每月月供 = 每月本金 + 每月利息
 *  月供逐月递减
 * ============================================================ */

/**
 * 等额本金计算
 */
export function calcEqualPrincipal(params: MortgageParams): MortgageResult {
  const { loanAmount, years, annualRate } = params;
  const totalMonths = Math.round(years * 12);
  const monthlyRate = getMonthlyRate(annualRate);

  // 每月固定本金
  const monthlyPrincipal = loanAmount / totalMonths;

  const schedule: MortgagePaymentItem[] = [];
  let remaining = loanAmount;
  let totalInterest = 0;

  for (let i = 1; i <= totalMonths; i++) {
    const interest = remaining * monthlyRate;
    const payment = monthlyPrincipal + interest;
    remaining -= monthlyPrincipal;
    // 最后一期修正
    if (i === totalMonths) {
      remaining = 0;
    }
    totalInterest += interest;

    schedule.push({
      period: i,
      monthlyPayment: payment,
      principal: monthlyPrincipal,
      interest,
      remainingPrincipal: Math.max(0, remaining),
    });
  }

  const totalPayment = loanAmount + totalInterest;

  return {
    type: 'equal-principal',
    loanAmount,
    totalMonths,
    annualRate,
    monthlyRate,
    totalPayment,
    totalInterest,
    firstMonthPayment: schedule[0]?.monthlyPayment ?? 0,
    lastMonthPayment: schedule[schedule.length - 1]?.monthlyPayment ?? 0,
    schedule,
  };
}

/** ============================================================
 *  统一入口
 * ============================================================ */

/**
 * 计算房贷
 */
export function calcMortgage(params: MortgageParams): MortgageResult {
  // 参数校验
  if (params.loanAmount <= 0) {
    throw new Error('贷款金额必须大于 0');
  }
  if (params.years <= 0) {
    throw new Error('贷款期限必须大于 0');
  }
  if (params.annualRate < 0) {
    throw new Error('年利率不能为负数');
  }

  if (params.type === 'equal-principal') {
    return calcEqualPrincipal(params);
  }
  return calcEqualPrincipalInterest(params);
}

/**
 * 生成还款计划摘要（用于图表等场景，按年汇总）
 */
export function getYearlySummary(result: MortgageResult): {
  year: number;
  payment: number;
  principal: number;
  interest: number;
  remaining: number;
}[] {
  const { schedule, totalMonths } = result;
  const years = Math.ceil(totalMonths / 12);
  const summary: { year: number; payment: number; principal: number; interest: number; remaining: number }[] = [];

  for (let y = 1; y <= years; y++) {
    const startIdx = (y - 1) * 12;
    const endIdx = Math.min(y * 12, totalMonths);
    let payment = 0;
    let principal = 0;
    let interest = 0;

    for (let i = startIdx; i < endIdx; i++) {
      payment += schedule[i].monthlyPayment;
      principal += schedule[i].principal;
      interest += schedule[i].interest;
    }

    summary.push({
      year: y,
      payment,
      principal,
      interest,
      remaining: schedule[endIdx - 1].remainingPrincipal,
    });
  }

  return summary;
}

/** 等额本息计算（别名，兼容调用方命名） */
export function calculateEqualPayment(params: MortgageParams): MortgageResult {
  return calcEqualPrincipalInterest(params);
}

/** 等额本金计算（别名，兼容调用方命名） */
export function calculateEqualPrincipal(params: MortgageParams): MortgageResult {
  return calcEqualPrincipal(params);
}
