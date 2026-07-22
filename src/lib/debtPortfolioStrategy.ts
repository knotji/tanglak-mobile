// Ported from tanglak-debt-strategy's src/lib/{debt/portfolio-strategy,
// finance/portfolio-recommendation}.ts -- unlike debtSimulator.ts, this
// feature never made it into tanglak's actual master (checked git history:
// its merge commit exists but master never descends from it, i.e. the PR
// was merged into an abandoned line of history). Ported anyway per an
// explicit user request to build both the proven single-debt simulator and
// this multi-debt comparison. Pure math, no Supabase dependency.
import type { Debt } from '@/lib/debts';
import { simulateDebtPayment, type DebtSimulationOutput } from '@/lib/debtSimulator';
import { formatTHB } from '@/lib/money';

export type DebtStrategy = 'snowball' | 'avalanche';

export interface PortfolioSimulationContext {
  plannedIncomeSatang?: number;
  currentMonthSpendingSatang?: number;
  debtPaymentsThisMonthSatang?: number;
  minimumCashReserveSatang?: number;
  safeBufferSatang?: number;
}

export interface DebtStrategySimulationDetail {
  debtId: string;
  monthlyPaymentSatang: number;
  estimatedRemainingInterestSatang: number;
  estimatedInstallmentsRemaining: number | null;
  estimatedPayoffDate: string | null;
  warnings: string[];
  output: DebtSimulationOutput;
}

export interface DebtStrategyResult {
  strategy: DebtStrategy;
  orderedDebtIds: string[];
  focusDebtId: string | null;
  totalEstimatedRemainingInterestSatang: number;
  simulations: DebtStrategySimulationDetail[];
}

export interface DebtPortfolioComparison {
  snowball: DebtStrategyResult;
  avalanche: DebtStrategyResult;
  interestDifferenceSatang: number;
  activeDebtCount: number;
}

export function filterActiveDebts(debts: readonly Debt[]): Debt[] {
  return debts.filter((debt) => debt.status === 'active');
}

function balanceOf(debt: Debt): number {
  return debt.outstandingBalanceSatang ?? 0;
}

function minimumOf(debt: Debt): number {
  return debt.minimumPaymentSatang ?? debt.amountDueSatang ?? 0;
}

function interestRateOf(debt: Debt): number {
  return debt.interestRateAnnual ?? 0;
}

function compareDueDateThenId(a: Debt, b: Debt): number {
  if (a.dueDate !== b.dueDate) {
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return a.dueDate.localeCompare(b.dueDate);
  }
  return a.id.localeCompare(b.id);
}

/** Smallest balance first -- pay it off fastest for an early psychological win. */
export function orderBySnowball(debts: readonly Debt[]): Debt[] {
  return [...filterActiveDebts(debts)].sort((a, b) => {
    const balanceDiff = balanceOf(a) - balanceOf(b);
    if (balanceDiff !== 0) return balanceDiff;
    const interestDiff = interestRateOf(b) - interestRateOf(a);
    if (interestDiff !== 0) return interestDiff;
    return compareDueDateThenId(a, b);
  });
}

/** Highest interest rate first -- minimizes total interest paid across the portfolio. */
export function orderByAvalanche(debts: readonly Debt[]): Debt[] {
  return [...filterActiveDebts(debts)].sort((a, b) => {
    const interestDiff = interestRateOf(b) - interestRateOf(a);
    if (interestDiff !== 0) return interestDiff;
    const balanceDiff = balanceOf(a) - balanceOf(b);
    if (balanceDiff !== 0) return balanceDiff;
    return compareDueDateThenId(a, b);
  });
}

function assertValidExtraPaymentBudget(extraPaymentBudgetSatang: number): void {
  if (!Number.isFinite(extraPaymentBudgetSatang)) throw new Error('รูปแบบจำนวนเงินไม่ถูกต้อง');
  if (extraPaymentBudgetSatang < 0) throw new Error('จำนวนเงินต้องไม่ติดลบ');
  if (!Number.isInteger(extraPaymentBudgetSatang)) throw new Error('extraPaymentBudgetSatang must be an integer');
}

function buildStrategyResult(
  strategy: DebtStrategy,
  orderedDebts: readonly Debt[],
  extraPaymentBudgetSatang: number,
  context: PortfolioSimulationContext,
): DebtStrategyResult {
  const focusDebtId = orderedDebts[0]?.id ?? null;
  const simulations = orderedDebts.map((debt): DebtStrategySimulationDetail => {
    const isFocusDebt = debt.id === focusDebtId;
    const minimumPaymentSatang = minimumOf(debt);
    const monthlyPaymentSatang = minimumPaymentSatang + (isFocusDebt ? extraPaymentBudgetSatang : 0);
    const output = simulateDebtPayment({
      balanceSatang: balanceOf(debt),
      interestRatePercent: interestRateOf(debt),
      interestRatePeriod: 'annual',
      minimumPaymentSatang,
      paymentAmountSatang: monthlyPaymentSatang,
      dueDate: debt.dueDate,
      extraPaymentBehavior: 'reduce_principal',
      ...context,
    });

    return {
      debtId: debt.id,
      monthlyPaymentSatang: output.paymentAmountSatang,
      estimatedRemainingInterestSatang: output.estimatedRemainingInterestSatang ?? 0,
      estimatedInstallmentsRemaining: output.estimatedInstallmentsRemaining,
      estimatedPayoffDate: output.estimatedPayoffDate,
      warnings: output.warnings,
      output,
    };
  });

  return {
    strategy,
    orderedDebtIds: orderedDebts.map((debt) => debt.id),
    focusDebtId,
    totalEstimatedRemainingInterestSatang: simulations.reduce((sum, s) => sum + s.estimatedRemainingInterestSatang, 0),
    simulations,
  };
}

/** Compares snowball vs avalanche ordering across every active debt, given one shared extra-payment budget applied to whichever debt each strategy puts first. */
export function buildDebtPortfolioComparison(
  debts: readonly Debt[],
  extraPaymentBudgetSatang: number,
  context: PortfolioSimulationContext = {},
): DebtPortfolioComparison {
  assertValidExtraPaymentBudget(extraPaymentBudgetSatang);

  const activeDebts = filterActiveDebts(debts);
  const snowball = buildStrategyResult('snowball', orderBySnowball(activeDebts), extraPaymentBudgetSatang, context);
  const avalanche = buildStrategyResult('avalanche', orderByAvalanche(activeDebts), extraPaymentBudgetSatang, context);

  return {
    snowball,
    avalanche,
    interestDifferenceSatang: snowball.totalEstimatedRemainingInterestSatang - avalanche.totalEstimatedRemainingInterestSatang,
    activeDebtCount: activeDebts.length,
  };
}

export const AVALANCHE_MIN_INTEREST_SAVING_SATANG = 500_00; // ฿500

export interface PortfolioRecommendation {
  recommendedStrategy: DebtStrategy;
  focusDebtId: string | null;
  estimatedInterestSavingSatang: number;
  reason: string;
}

export function portfolioStrategyLabel(strategy: DebtStrategy): string {
  return strategy === 'avalanche' ? 'ลดดอกเบี้ยก่อน' : 'ปิดก้อนเล็กก่อน';
}

/** Recommends avalanche only when it saves a meaningful amount of interest; otherwise snowball, for an earlier motivating win. Returns null with fewer than 2 active debts (nothing to compare). */
export function recommendFocusDebt(comparison: DebtPortfolioComparison): PortfolioRecommendation | null {
  if (comparison.activeDebtCount < 2) return null;

  const avalancheSavingSatang = Math.max(0, comparison.interestDifferenceSatang);
  if (avalancheSavingSatang > AVALANCHE_MIN_INTEREST_SAVING_SATANG) {
    return {
      recommendedStrategy: 'avalanche',
      focusDebtId: comparison.avalanche.focusDebtId,
      estimatedInterestSavingSatang: avalancheSavingSatang,
      reason: `แนะนำ${portfolioStrategyLabel('avalanche')} เพราะคาดว่าจะลดดอกเบี้ยรวมได้ประมาณ ${formatTHB(avalancheSavingSatang)} เมื่อเทียบกับการปิดก้อนเล็กก่อน`,
    };
  }

  return {
    recommendedStrategy: 'snowball',
    focusDebtId: comparison.snowball.focusDebtId,
    estimatedInterestSavingSatang: avalancheSavingSatang,
    reason:
      avalancheSavingSatang > 0
        ? `ส่วนต่างดอกเบี้ยประมาณ ${formatTHB(avalancheSavingSatang)} ยังไม่สูงพอ จึงแนะนำ${portfolioStrategyLabel('snowball')}เพื่อให้เห็นชัยชนะเร็วขึ้น`
        : `ดอกเบี้ยรวมที่คาดไว้ใกล้เคียงกัน จึงแนะนำ${portfolioStrategyLabel('snowball')}เพื่อให้เห็นชัยชนะเร็วขึ้น`,
  };
}
