// Ported from tanglak's src/lib/debt/{payment-types,payment-simulator,
// payment-recommendation,payment-assumptions,payment-formatting}.ts -- a
// real, live feature at tanglak's /debts/[id]/simulate route (not the
// abandoned multi-debt portfolio-strategy branch). Pure math, no
// Supabase/network dependency, so it ports over close to verbatim.
//
// One deliberate deviation: the web version bakes a Buddhist-era Thai
// month/year string directly into estimatedPayoffDate (`start.getFullYear()
// + 543`). Every other date label in this mobile app is explicitly
// Gregorian (see date.ts) -- so here estimatedPayoffDate is a plain
// "YYYY-MM" key instead, formatted for display by the caller via
// formatThaiMonthYearLabel, consistent with how every other date in this
// app is formatted.

export type ExtraPaymentBehavior = 'reduce_principal' | 'advance_installment' | 'unknown';
export type InterestRatePeriod = 'monthly' | 'annual';
export type AffordabilityStatus = 'safe' | 'tight' | 'risky' | 'insufficient_data';

export interface DebtSimulationInput {
  balanceSatang: number;
  /** e.g. 15 for 15% annual, or 1.25 for 1.25% monthly. */
  interestRatePercent: number;
  interestRatePeriod: InterestRatePeriod;
  minimumPaymentSatang: number;
  paymentAmountSatang: number;
  /** "YYYY-MM-DD". */
  dueDate?: string | null;
  nextInterestSatang?: number;
  extraPaymentBehavior: ExtraPaymentBehavior;
  earlyPayoffFeeSatang?: number;
  plannedIncomeSatang?: number;
  currentMonthSpendingSatang?: number;
  debtPaymentsThisMonthSatang?: number;
  minimumCashReserveSatang?: number;
  safeBufferSatang?: number;
}

export interface DebtSimulationOutput {
  paymentAmountSatang: number;
  interestPaidThisPaymentSatang: number;
  principalPaidThisPaymentSatang: number;
  balanceAfterPaymentSatang: number;
  nextPeriodInterestSatang: number;
  estimatedInstallmentsRemaining: number | null;
  /** "YYYY-MM", or null if it can't be estimated. */
  estimatedPayoffDate: string | null;
  estimatedRemainingInterestSatang: number | null;
  interestSavedVsMinimumSatang: number | null;
  cashRemainingAfterPaymentSatang: number | null;
  affordabilityStatus: AffordabilityStatus;
  warnings: string[];
  assumptions: string[];
  precisionLevel: 'full' | 'limited' | 'none';
  affordablePaymentSatang: number | null;
  shortfallSatang: number | null;
}

export function getMonthlyRatePercent(ratePercent: number, period: InterestRatePeriod): number {
  if (ratePercent <= 0) return 0;
  return period === 'annual' ? ratePercent / 12 : ratePercent;
}

function payoffMonthKey(dueDate: string, monthsFromNow: number): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dueDate);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const start = new Date(Date.UTC(year, month - 1, 1));
  start.setUTCMonth(start.getUTCMonth() + monthsFromNow);
  return `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Runs a deterministic projection of a debt's payoff. Pure; throws on invalid (negative) money inputs. */
export function simulateDebtPayment(input: DebtSimulationInput): DebtSimulationOutput {
  const {
    balanceSatang,
    interestRatePercent,
    interestRatePeriod,
    minimumPaymentSatang,
    paymentAmountSatang,
    dueDate,
    nextInterestSatang,
    extraPaymentBehavior,
    earlyPayoffFeeSatang = 0,
    plannedIncomeSatang,
    currentMonthSpendingSatang,
    debtPaymentsThisMonthSatang,
    minimumCashReserveSatang,
    safeBufferSatang,
  } = input;

  if (balanceSatang < 0) throw new Error('Outstanding balance cannot be negative');
  if (minimumPaymentSatang < 0) throw new Error('Minimum payment cannot be negative');
  if (paymentAmountSatang < 0) throw new Error('Payment amount cannot be negative');

  const warnings: string[] = [];
  const assumptions: string[] = [];

  const monthlyRatePercent = getMonthlyRatePercent(interestRatePercent, interestRatePeriod);
  assumptions.push(
    interestRatePeriod === 'annual'
      ? 'คำนวณโดยแปลงอัตราดอกเบี้ยรายปีเป็นรายเดือนแบบหาร 12 (Nominal Rate)'
      : 'คำนวณจากดอกเบี้ยแบบรายเดือนโดยตรง',
  );
  assumptions.push('สมมติว่าอัตราดอกเบี้ยไม่เปลี่ยนแปลงตลอดอายุสัญญา');
  assumptions.push('สมมติว่าชำระตรงเวลาทุกงวดและไม่มีการค้างชำระ');

  let firstMonthInterest =
    nextInterestSatang !== undefined && nextInterestSatang >= 0
      ? nextInterestSatang
      : Math.round(balanceSatang * (monthlyRatePercent / 100));
  firstMonthInterest = Math.max(0, firstMonthInterest);
  if (nextInterestSatang !== undefined && nextInterestSatang >= 0) {
    assumptions.push(`ใช้ดอกเบี้ยงวดถัดไปที่ระบุจำนวน ${nextInterestSatang / 100} บาท สำหรับงวดปัจจุบัน`);
  }

  const basicPayoffAmount = balanceSatang + firstMonthInterest;
  const fullPayoffAmount = basicPayoffAmount + earlyPayoffFeeSatang;

  let actualPaymentThisMonth = paymentAmountSatang;
  let isFullyPaidThisMonth = false;
  if (actualPaymentThisMonth >= fullPayoffAmount) {
    actualPaymentThisMonth = fullPayoffAmount;
    isFullyPaidThisMonth = true;
  } else if (actualPaymentThisMonth >= basicPayoffAmount) {
    actualPaymentThisMonth = basicPayoffAmount;
    isFullyPaidThisMonth = true;
  }

  const interestPaidThisPayment = Math.min(firstMonthInterest, actualPaymentThisMonth);
  let remainingAfterInterest = actualPaymentThisMonth - interestPaidThisPayment;

  if (isFullyPaidThisMonth && earlyPayoffFeeSatang > 0) {
    const feePaid = Math.min(earlyPayoffFeeSatang, remainingAfterInterest);
    remainingAfterInterest -= feePaid;
    assumptions.push(`รวมค่าธรรมเนียมการปิดบัญชีก่อนกำหนดจำนวน ${earlyPayoffFeeSatang / 100} บาท`);
  }

  const principalPaidThisPayment = Math.min(balanceSatang, remainingAfterInterest);
  const balanceAfterPayment = balanceSatang - principalPaidThisPayment;
  const nextPeriodInterest = Math.max(0, Math.round(balanceAfterPayment * (monthlyRatePercent / 100)));

  if (actualPaymentThisMonth <= firstMonthInterest && balanceSatang > 0) {
    warnings.push(
      actualPaymentThisMonth < firstMonthInterest
        ? 'ยอดชำระน้อยกว่าดอกเบี้ยที่เกิดขึ้นในงวดนี้ ซึ่งจะทำให้ยอดหนี้สะสมเพิ่มขึ้น'
        : 'ยอดชำระเท่ากับดอกเบี้ยพอดี ซึ่งจะไม่ลดเงินต้นเลย',
    );
  }

  let precisionLevel: 'full' | 'limited' | 'none' = 'full';
  if (extraPaymentBehavior === 'unknown') {
    precisionLevel = 'limited';
    warnings.push('ควรตรวจสอบกับผู้ให้กู้ก่อนว่าเงินที่จ่ายเกินขั้นต่ำจะถูกนำไปลดเงินต้นหรือไม่');
    assumptions.push('สมมติว่าผู้ให้กู้นำเงินส่วนเกินขั้นต่ำไปลดเงินต้นทันที (กรณียังไม่ยืนยันเงื่อนไข)');
  } else if (extraPaymentBehavior === 'advance_installment') {
    warnings.push('ผู้ให้กู้อาจจัดสรรเงินส่วนเกินเป็นยอดชำระล่วงหน้า (Advance) ซึ่งอาจไม่ช่วยลดเงินต้นในรอบนี้');
    assumptions.push('คำนวณตามเงื่อนไขที่เงินส่วนเกินไม่ลดเงินต้นเพื่อคำนวณดอกเบี้ย (Advance Installment)');
  }

  const projectAmortization = (startBalance: number, periodicPayment: number, behavior: ExtraPaymentBehavior) => {
    let currentBalance = startBalance;
    let totalInterest = firstMonthInterest;
    let months = 1;
    if (currentBalance <= 0) return { months, totalInterest, doesAmortize: true };

    const maxMonths = 600;
    let doesAmortize = true;
    let minPlanBalance = startBalance;

    while (currentBalance > 0 && months < maxMonths) {
      const interestBasis = behavior === 'advance_installment' ? minPlanBalance : currentBalance;
      const interest = Math.max(0, Math.round(interestBasis * (monthlyRatePercent / 100)));

      if (behavior === 'advance_installment') {
        const minInterest = Math.max(0, Math.round(minPlanBalance * (monthlyRatePercent / 100)));
        const minPayment = Math.min(minimumPaymentSatang, minPlanBalance + minInterest);
        const minPrincipal = Math.max(0, minPayment - minInterest);
        minPlanBalance = Math.max(0, minPlanBalance - minPrincipal);
      }

      if (periodicPayment <= interest) {
        doesAmortize = false;
        break;
      }

      const payoff = currentBalance + interest;
      const actualPay = Math.min(periodicPayment, payoff);
      const interestPaid = Math.min(interest, actualPay);
      const principalPaid = actualPay - interestPaid;

      currentBalance -= principalPaid;
      totalInterest += interest;
      months++;
    }

    return { months, totalInterest, doesAmortize: currentBalance <= 0 && doesAmortize };
  };

  const minBaseline = projectAmortization(balanceAfterPayment, minimumPaymentSatang, 'reduce_principal');
  const currentPlan = projectAmortization(balanceAfterPayment, paymentAmountSatang, extraPaymentBehavior);

  let estimatedInstallmentsRemaining: number | null = null;
  let estimatedPayoffDate: string | null = null;
  let estimatedRemainingInterest: number | null = null;
  let interestSavedVsMinimum: number | null = null;

  if (extraPaymentBehavior !== 'unknown') {
    if (currentPlan.doesAmortize) {
      estimatedInstallmentsRemaining = currentPlan.months;
      estimatedRemainingInterest = Math.max(0, currentPlan.totalInterest - interestPaidThisPayment);
      if (dueDate) estimatedPayoffDate = payoffMonthKey(dueDate, currentPlan.months - 1);
    } else {
      estimatedRemainingInterest = 0;
      warnings.push('ยอดชำระเฉลี่ยต่ำเกินไปสำหรับการชำระหนี้ให้หมด (หนี้ไม่ลดลงหรือลดลงช้ามาก)');
    }

    if (minBaseline.doesAmortize && currentPlan.doesAmortize) {
      interestSavedVsMinimum =
        extraPaymentBehavior === 'advance_installment' ? 0 : Math.max(0, minBaseline.totalInterest - currentPlan.totalInterest);
    } else {
      interestSavedVsMinimum = 0;
    }
  }

  let cashRemainingAfterPayment: number | null = null;
  let affordabilityStatus: AffordabilityStatus = 'insufficient_data';
  let affordablePaymentSatang: number | null = null;
  let shortfallSatang: number | null = null;

  const hasContext =
    plannedIncomeSatang !== undefined && currentMonthSpendingSatang !== undefined && debtPaymentsThisMonthSatang !== undefined;

  if (hasContext) {
    const remainingCash = plannedIncomeSatang - currentMonthSpendingSatang - debtPaymentsThisMonthSatang - actualPaymentThisMonth;
    cashRemainingAfterPayment = remainingCash;

    const minReserve = minimumCashReserveSatang || 0;
    const safeBuffer = safeBufferSatang || 0;

    if (actualPaymentThisMonth < minimumPaymentSatang && actualPaymentThisMonth < fullPayoffAmount) {
      affordabilityStatus = 'risky';
    } else if (remainingCash >= minReserve + safeBuffer) {
      affordabilityStatus = 'safe';
    } else if (remainingCash >= minReserve) {
      affordabilityStatus = 'tight';
    } else {
      affordabilityStatus = 'risky';
    }

    const availableCashBeforeThis = plannedIncomeSatang - currentMonthSpendingSatang - debtPaymentsThisMonthSatang;
    affordablePaymentSatang = Math.max(0, availableCashBeforeThis - minReserve);
    if (affordablePaymentSatang < minimumPaymentSatang) {
      shortfallSatang = minimumPaymentSatang - affordablePaymentSatang;
      warnings.push('เงินเหลือเดือนนี้อาจไม่พอสำหรับยอดขั้นต่ำ');
    }
  }

  return {
    paymentAmountSatang: actualPaymentThisMonth,
    interestPaidThisPaymentSatang: interestPaidThisPayment,
    principalPaidThisPaymentSatang: principalPaidThisPayment,
    balanceAfterPaymentSatang: balanceAfterPayment,
    nextPeriodInterestSatang: nextPeriodInterest,
    estimatedInstallmentsRemaining,
    estimatedPayoffDate,
    estimatedRemainingInterestSatang: estimatedRemainingInterest !== null ? Math.max(0, estimatedRemainingInterest) : null,
    interestSavedVsMinimumSatang: interestSavedVsMinimum,
    cashRemainingAfterPaymentSatang: cashRemainingAfterPayment,
    affordabilityStatus,
    warnings,
    assumptions,
    precisionLevel,
    affordablePaymentSatang,
    shortfallSatang,
  };
}

export interface PlanOptions {
  minimum: DebtSimulationOutput;
  recommended: DebtSimulationOutput;
  accelerated: DebtSimulationOutput;
  recommendedAmountSatang: number | null;
  acceleratedAmountSatang: number | null;
}

/** Three ready-made plans (minimum / recommended / accelerated) so the UI doesn't need to reason about affordability math itself. */
export function generatePlanOptions(input: Omit<DebtSimulationInput, 'paymentAmountSatang'>): PlanOptions {
  const {
    balanceSatang,
    interestRatePercent,
    interestRatePeriod,
    minimumPaymentSatang,
    nextInterestSatang,
    earlyPayoffFeeSatang = 0,
    plannedIncomeSatang,
    currentMonthSpendingSatang,
    debtPaymentsThisMonthSatang,
    minimumCashReserveSatang = 0,
    safeBufferSatang = 0,
  } = input;

  const monthlyRatePercent = getMonthlyRatePercent(interestRatePercent, interestRatePeriod);
  let firstMonthInterest =
    nextInterestSatang !== undefined && nextInterestSatang >= 0
      ? nextInterestSatang
      : Math.round(balanceSatang * (monthlyRatePercent / 100));
  firstMonthInterest = Math.max(0, firstMonthInterest);
  const payoffAmountSatang = balanceSatang + firstMonthInterest + earlyPayoffFeeSatang;

  let recAmountSatang: number | null = null;
  let accAmountSatang: number | null = null;

  const hasContext =
    plannedIncomeSatang !== undefined && currentMonthSpendingSatang !== undefined && debtPaymentsThisMonthSatang !== undefined;

  if (hasContext) {
    const availableCashFlow = plannedIncomeSatang - currentMonthSpendingSatang - debtPaymentsThisMonthSatang;

    const affordableRec = availableCashFlow - minimumCashReserveSatang - safeBufferSatang;
    recAmountSatang = affordableRec >= minimumPaymentSatang ? Math.min(payoffAmountSatang, affordableRec) : null;

    const affordableAcc = availableCashFlow - minimumCashReserveSatang;
    if (affordableAcc >= minimumPaymentSatang) {
      accAmountSatang = Math.min(payoffAmountSatang, affordableAcc);
      if (recAmountSatang !== null) accAmountSatang = Math.max(accAmountSatang, recAmountSatang);
    } else {
      accAmountSatang = null;
    }
  }

  return {
    minimum: simulateDebtPayment({ ...input, paymentAmountSatang: minimumPaymentSatang }),
    recommended: simulateDebtPayment({ ...input, paymentAmountSatang: recAmountSatang ?? minimumPaymentSatang }),
    accelerated: simulateDebtPayment({ ...input, paymentAmountSatang: accAmountSatang ?? minimumPaymentSatang }),
    recommendedAmountSatang: recAmountSatang,
    acceleratedAmountSatang: accAmountSatang,
  };
}

export const SIMULATOR_ASSUMPTIONS = [
  'ผลลัพธ์การคำนวณเป็นเพียงการประมาณการเพื่อช่วยวางแผน ไม่ใช่ยอดยืนยันจากสถาบันการเงินผู้ให้กู้',
  'คำนวณบนสมมติฐานว่าคุณจ่ายเงินตรงตามเวลาทุกงวด และไม่มียอดค้างชำระอื่นๆ',
  'อัตราดอกเบี้ยถูกกำหนดให้คงที่ตลอดระยะเวลาการผ่อนชำระ',
  'ยอดเงินเหลือใช้เดือนนี้คำนวณจากแผนรายได้ลบด้วยรายจ่ายจริงและเงินสำรองที่คุณระบุ',
  "หากเงื่อนไขการชำระเงินส่วนเกินไม่เป็นไปตามแบบ 'ลดต้นลดดอก' ผลประหยัดดอกเบี้ยจริงอาจต่างจากที่ประมาณการไว้",
];

export const LENDER_RISK_WARNING =
  "ผู้ให้กู้บางรายอาจจัดสรรยอดชำระที่เกินขั้นต่ำเป็น 'เงินจ่ายล่วงหน้าสำหรับงวดถัดไป' แทนการนำไปลดเงินต้นทันที ควรตรวจสอบเงื่อนไขกับผู้ให้กู้ทุกครั้งเพื่อความคุ้มค่าสูงสุด";

export const UNKNOWN_BEHAVIOR_EXPLANATION = 'TangLak ยังไม่แสดงผลประหยัดดอกเบี้ยหรือวันปิดหนี้ที่เร็วขึ้น จนกว่าจะทราบเงื่อนไขนี้';

export function formatInstallments(months: number | null): string {
  return months === null ? 'ไม่ระบุ' : `${months} งวด`;
}
