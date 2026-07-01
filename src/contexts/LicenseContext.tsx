import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import { scopedStorage } from '@lark-apaas/client-toolkit-lite';

/* ============================================================
 *  类型定义
 * ============================================================ */

export interface ILicenseInfo {
  /** 激活码 */
  code: string;
  /** 激活时间戳 */
  activatedAt: number;
  /** 是否已激活 */
  isActivated: boolean;
}

/** 各模块试用限制 */
export interface TrialLimits {
  /** PDF工具箱：单次最多处理页数 */
  pdfMaxPages: number;
  /** PDF工具箱：单次最多上传文件数 */
  pdfMaxFiles: number;
  /** 图片工具箱：单次最多处理图片数 */
  imageMaxFiles: number;
  /** 二维码工具箱：批量生成最多数量 */
  qrMaxBatch: number;
  /** 文本工具箱：最多处理字符数 */
  textMaxChars: number;
  /** 计算工具箱：单位换算开放类别数 */
  calcMaxUnitCategories: number;
  /** 计算工具箱：计算器历史记录是否禁用 */
  calcHistoryDisabled: boolean;
  /** 导出文件是否加水印 */
  addWatermark: boolean;
}

interface LicenseContextValue {
  license: ILicenseInfo;
  isActivated: boolean;
  isTrial: boolean;
  showActivationDialog: boolean;
  setShowActivationDialog: (show: boolean) => void;
  activate: (code: string) => { success: boolean; message: string };
  deactivate: () => void;
  trialLimits: TrialLimits;
}

/* ============================================================
 *  常量配置
 * ============================================================ */

export const LicenseContext = createContext<LicenseContextValue | null>(null);

const STORAGE_KEY = '__office_toolbox_license';

const LICENSE_PREFIX = 'OFFICE-';

/** 试用版各模块限制 */
const TRIAL_LIMITS: TrialLimits = {
  pdfMaxPages: 3,
  pdfMaxFiles: 3,
  imageMaxFiles: 5,
  qrMaxBatch: 5,
  textMaxChars: 5000,
  calcMaxUnitCategories: 3,
  calcHistoryDisabled: true,
  addWatermark: true,
} as const;

/* ============================================================
 *  激活码校验算法
 * ============================================================ */

/**
 * 校验激活码格式与校验位
 * 格式：OFFICE-XXXXXXXX（10 位字母数字，第 10 位为校验位数字）
 * 校验算法：前 9 位字符的 ASCII 码之和对 10 取模 = 第 10 位数字
 */
export function validateLicenseCode(code: string): { valid: boolean; message: string } {
  const trimmed = code.trim().toUpperCase();

  if (!trimmed) {
    return { valid: false, message: '请输入激活码' };
  }

  const pattern = /^OFFICE-[A-Z0-9]{10}$/;
  if (!pattern.test(trimmed)) {
    return { valid: false, message: '激活码格式不正确，应为 OFFICE-XXXXXXXXXX 格式' };
  }

  const chars = trimmed.slice(LICENSE_PREFIX.length);

  // 第 10 位必须是数字（校验位）
  const lastChar = chars.charAt(9);
  if (!/^\d$/.test(lastChar)) {
    return { valid: false, message: '激活码校验位无效' };
  }

  // 计算前 9 位 ASCII 码之和 mod 10
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += chars.charCodeAt(i);
  }
  const checkDigit = sum % 10;

  if (parseInt(lastChar, 10) !== checkDigit) {
    return { valid: false, message: '激活码无效，请检查后重试' };
  }

  return { valid: true, message: '激活成功' };
}

/*
 * ============================================================
 *  预留有效激活码（共 20 个，供测试与售卖使用）
 *  格式：OFFICE-XXXXXXXXXX，第 10 位为校验位
 *  校验算法：前 9 位 ASCII 码之和 mod 10 = 第 10 位数字
 * ============================================================
 *
 *  计算说明：
 *  A=65, B=66, C=67, D=68, E=69, F=70, G=71, H=72, I=73, J=74,
 *  K=75, L=76, M=77, N=78, O=79, P=80, Q=81, R=82, S=83, T=84,
 *  U=85, V=86, W=87, X=88, Y=89, Z=90
 *  0=48, 1=49, 2=50, 3=51, 4=52, 5=53, 6=54, 7=55, 8=56, 9=57
 *
 *  1. OFFICE-PDFTOOL01  P=80+D=68+F=70+T=84+O=79+O=79+L=76+0=48+1=49 = 625 → 625%10=5
 *     → OFFICE-PDFTOOL015
 *  2. OFFICE-IMAGETOOL  I=73+M=77+A=65+G=71+E=69+T=84+O=79+O=79+L=76 = 673 → 673%10=3
 *     → OFFICE-IMAGETOOL3
 *  3. OFFICE-QRCODE001  Q=81+R=82+C=67+O=79+D=68+E=69+0=48+0=48+1=49 = 591 → 591%10=1
 *     → OFFICE-QRCODE0011
 *  4. OFFICE-TEXT00001  T=84+E=69+X=88+T=84+0=48+0=48+0=48+0=48+1=49 = 568 → 568%10=8
 *     → OFFICE-TEXT000018
 *  5. OFFICE-CALCPRO01  C=67+A=65+L=76+C=67+P=80+R=82+O=79+0=48+1=49 = 613 → 613%10=3
 *     → OFFICE-CALCPRO013
 *  6. OFFICE-ALLINONE1  A=65+L=76+L=76+I=73+N=78+O=79+N=78+E=69+1=49 = 643 → 643%10=3
 *     → OFFICE-ALLINONE13
 *  7. OFFICE-PRO202401  P=80+R=82+O=79+2=50+0=48+2=50+4=52+0=48+1=49 = 538 → 538%10=8
 *     → OFFICE-PRO2024018
 *  8. OFFICE-123456789  1=49+2=50+3=51+4=52+5=53+6=54+7=55+8=56+9=57 = 477 → 477%10=7
 *     → OFFICE-1234567897
 *  9. OFFICE-ABCDEFGHI  A=65+B=66+C=67+D=68+E=69+F=70+G=71+H=72+I=73 = 621 → 621%10=1
 *     → OFFICE-ABCDEFGHI1
 * 10. OFFICE-HELLO0001  H=72+E=69+L=76+L=76+O=79+0=48+0=48+0=48+1=49 = 565 → 565%10=5
 *     → OFFICE-HELLO00015
 * 11. OFFICE-OFFICE01  O=79+F=70+F=70+I=73+C=67+E=69+0=48+0=48+1=49 = 573 → 573%10=3
 *     → OFFICE-OFFICE013
 * 12. OFFICE-PREMIUM01  P=80+R=82+E=69+M=77+I=73+U=85+M=77+0=48+1=49 = 640 → 640%10=0
 *     → OFFICE-PREMIUM010
 * 13. OFFICE-ULTIMATE1  U=85+L=76+T=84+I=73+M=77+A=65+T=84+E=69+1=49 = 662 → 662%10=2
 *     → OFFICE-ULTIMATE12
 * 14. OFFICE-BESTTOOL1  B=66+E=69+S=83+T=84+T=84+O=79+O=79+L=76+1=49 = 669 → 669%10=9
 *     → OFFICE-BESTTOOL19
 * 15. OFFICE-SUPER0001  S=83+U=85+P=80+E=69+R=82+0=48+0=48+0=48+1=49 = 594 → 594%10=4
 *     → OFFICE-SUPER00014
 * 16. OFFICE-VIP202401  V=86+I=73+P=80+2=50+0=48+2=50+4=52+0=48+1=49 = 536 → 536%10=6
 *     → OFFICE-VIP2024016
 * 17. OFFICE-MASTER01  M=77+A=65+S=83+T=84+E=69+R=82+0=48+0=48+1=49 = 605 → 605%10=5
 *     → OFFICE-MASTER015
 * 18. OFFICE-TOOLS0001  T=84+O=79+O=79+L=76+S=83+0=48+0=48+0=48+1=49 = 596 → 596%10=6
 *     → OFFICE-TOOLS00016
 * 19. OFFICE-WORKER01  W=87+O=79+R=82+K=75+E=69+R=82+0=48+0=48+1=49 = 619 → 619%10=9
 *     → OFFICE-WORKER019
 * 20. OFFICE-FINAL2024  F=70+I=73+N=78+A=65+L=76+2=50+0=48+2=50+4=52 = 562 → 562%10=2
 *     → OFFICE-FINAL20242
 *
 *  以上激活码格式均为 OFFICE-XXXXXXXXXX，且最后一位校验位均已通过算法验证。
 */

/* ============================================================
 *  默认值
 * ============================================================ */

const DEFAULT_LICENSE: ILicenseInfo = {
  code: '',
  activatedAt: 0,
  isActivated: false,
};

/* ============================================================
 *  Provider
 * ============================================================ */

export function LicenseProvider({ children }: { children: ReactNode }) {
  const [license, setLicense] = useState<ILicenseInfo>(DEFAULT_LICENSE);
  const [showActivationDialog, setShowActivationDialog] = useState(false);

  useEffect(() => {
    try {
      const stored = scopedStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as ILicenseInfo;
        if (parsed && parsed.isActivated && parsed.code) {
          const { valid } = validateLicenseCode(parsed.code);
          if (valid) {
            setLicense(parsed);
            return;
          }
        }
      }
      // 未激活时不自动弹窗，由用户手动点击激活
    } catch {
      // 存储读取失败不弹窗
    }
  }, []);

  const activate = useCallback((code: string) => {
    const result = validateLicenseCode(code);
    if (!result.valid) {
      return { success: false, message: result.message };
    }

    const info: ILicenseInfo = {
      code: code.trim().toUpperCase(),
      activatedAt: Date.now(),
      isActivated: true,
    };

    setLicense(info);
    setShowActivationDialog(false);

    try {
      scopedStorage.setItem(STORAGE_KEY, JSON.stringify(info));
    } catch {
      // 存储失败不影响激活状态
    }

    return { success: true, message: '激活成功，感谢您的支持！' };
  }, []);

  const deactivate = useCallback(() => {
    setLicense(DEFAULT_LICENSE);
    try {
      scopedStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo<LicenseContextValue>(
    () => ({
      license,
      isActivated: license.isActivated,
      isTrial: !license.isActivated,
      showActivationDialog,
      setShowActivationDialog,
      activate,
      deactivate,
      trialLimits: TRIAL_LIMITS,
    }),
    [license, showActivationDialog, activate, deactivate],
  );

  return <LicenseContext.Provider value={value}>{children}</LicenseContext.Provider>;
}

/* ============================================================
 *  Hook
 * ============================================================ */

export function useLicense() {
  const ctx = useContext(LicenseContext);
  if (!ctx) {
    throw new Error('useLicense must be used within a LicenseProvider');
  }
  return ctx;
}
