import { describe, expect, it } from 'vitest';
import {
  AVALANCHE_MIN_INTEREST_SAVING_SATANG,
  buildDebtPortfolioComparison,
  filterActiveDebts,
  orderByAvalanche,
  orderBySnowball,
  recommendFocusDebt,
  type DebtPortfolioComparison,
} from './debtPortfolioStrategy';
import type { Debt } from './debts';

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-a',
    name: 'บัตรเครดิต A',
    creditor: null,
    outstandingBalanceSatang: 1000000,
    amountDueSatang: 100000,
    minimumPaymentSatang: 100000,
    amountPaidThisCycleSatang: 0,
    dueDate: '2026-07-20',
    recurringDueDay: null,
    cycleStartDate: null,
    cycleEndDate: null,
    paymentMode: 'variable_monthly',
    interestRateAnnual: 18,
    notes: null,
    status: 'active',
    ...overrides,
  };
}

describe('filterActiveDebts', () => {
  it('keeps only debts with status active', () => {
    const active = makeDebt({ id: 'active' });
    const paidOff = makeDebt({ id: 'paid-off', status: 'paid_off' });
    const paused = makeDebt({ id: 'paused', status: 'paused' });
    expect(filterActiveDebts([paidOff, active, paused]).map((d) => d.id)).toEqual(['active']);
  });
});

describe('orderBySnowball', () => {
  it('orders by smallest balance, then higher interest, then earlier due date, then id', () => {
    const input = [
      makeDebt({ id: 'large', outstandingBalanceSatang: 5000000, interestRateAnnual: 30 }),
      makeDebt({ id: 'small-low-rate', outstandingBalanceSatang: 500000, interestRateAnnual: 8 }),
      makeDebt({ id: 'small-high-late', outstandingBalanceSatang: 500000, interestRateAnnual: 18, dueDate: '2026-07-25' }),
      makeDebt({ id: 'small-high-early', outstandingBalanceSatang: 500000, interestRateAnnual: 18, dueDate: '2026-07-10' }),
    ];
    expect(orderBySnowball(input).map((d) => d.id)).toEqual(['small-high-early', 'small-high-late', 'small-low-rate', 'large']);
  });

  it('does not mutate the input array order', () => {
    const input = [makeDebt({ id: 'b', outstandingBalanceSatang: 2 }), makeDebt({ id: 'a', outstandingBalanceSatang: 1 })];
    orderBySnowball(input);
    expect(input.map((d) => d.id)).toEqual(['b', 'a']);
  });
});

describe('orderByAvalanche', () => {
  it('orders by highest interest, then smaller balance, then due date, then id', () => {
    const input = [
      makeDebt({ id: 'zero-rate', outstandingBalanceSatang: 100000, interestRateAnnual: 0 }),
      makeDebt({ id: 'high-large', outstandingBalanceSatang: 5000000, interestRateAnnual: 24 }),
      makeDebt({ id: 'high-small', outstandingBalanceSatang: 500000, interestRateAnnual: 24 }),
      makeDebt({ id: 'mid', outstandingBalanceSatang: 300000, interestRateAnnual: 12 }),
    ];
    expect(orderByAvalanche(input).map((d) => d.id)).toEqual(['high-small', 'high-large', 'mid', 'zero-rate']);
  });
});

describe('buildDebtPortfolioComparison', () => {
  it('gives the focus debt minimum+extra and every other debt just its minimum', () => {
    const small = makeDebt({ id: 'small', outstandingBalanceSatang: 500000, minimumPaymentSatang: 50000, interestRateAnnual: 12 });
    const highRate = makeDebt({ id: 'high-rate', outstandingBalanceSatang: 2000000, minimumPaymentSatang: 100000, interestRateAnnual: 30 });
    const lowRate = makeDebt({ id: 'low-rate', outstandingBalanceSatang: 3000000, minimumPaymentSatang: 150000, interestRateAnnual: 6 });

    const comparison = buildDebtPortfolioComparison([lowRate, highRate, small], 30000);

    expect(comparison.activeDebtCount).toBe(3);
    expect(comparison.snowball.focusDebtId).toBe('small');
    expect(comparison.avalanche.focusDebtId).toBe('high-rate');
    expect(comparison.snowball.orderedDebtIds).toEqual(['small', 'high-rate', 'low-rate']);
    expect(comparison.avalanche.orderedDebtIds).toEqual(['high-rate', 'small', 'low-rate']);
    expect(comparison.snowball.simulations.find((s) => s.debtId === 'small')?.monthlyPaymentSatang).toBe(80000);
    expect(comparison.snowball.simulations.find((s) => s.debtId === 'high-rate')?.monthlyPaymentSatang).toBe(100000);
  });

  it('sums per-debt remaining interest into the strategy total', () => {
    const comparison = buildDebtPortfolioComparison(
      [makeDebt({ id: 'a', outstandingBalanceSatang: 500000 }), makeDebt({ id: 'b', outstandingBalanceSatang: 800000 })],
      0,
    );
    expect(comparison.snowball.totalEstimatedRemainingInterestSatang).toBe(
      comparison.snowball.simulations.reduce((sum, s) => sum + s.estimatedRemainingInterestSatang, 0),
    );
  });

  it('handles an empty list and a single debt', () => {
    const empty = buildDebtPortfolioComparison([], 0);
    expect(empty.activeDebtCount).toBe(0);
    expect(empty.snowball.focusDebtId).toBeNull();

    const single = buildDebtPortfolioComparison([makeDebt({ id: 'only' })], 0);
    expect(single.activeDebtCount).toBe(1);
    expect(single.snowball.focusDebtId).toBe('only');
    expect(single.avalanche.focusDebtId).toBe('only');
  });

  it('rejects an invalid extra payment budget instead of repairing it', () => {
    expect(() => buildDebtPortfolioComparison([makeDebt()], -1)).toThrow('จำนวนเงินต้องไม่ติดลบ');
    expect(() => buildDebtPortfolioComparison([makeDebt()], Number.NaN)).toThrow('รูปแบบจำนวนเงินไม่ถูกต้อง');
    expect(() => buildDebtPortfolioComparison([makeDebt()], 100.5)).toThrow('extraPaymentBudgetSatang must be an integer');
  });
});

describe('recommendFocusDebt', () => {
  function comparison(overrides: Partial<DebtPortfolioComparison> = {}): DebtPortfolioComparison {
    return {
      activeDebtCount: 2,
      interestDifferenceSatang: 0,
      snowball: { strategy: 'snowball', orderedDebtIds: ['small', 'high'], focusDebtId: 'small', totalEstimatedRemainingInterestSatang: 1000000, simulations: [] },
      avalanche: { strategy: 'avalanche', orderedDebtIds: ['high', 'small'], focusDebtId: 'high', totalEstimatedRemainingInterestSatang: 990000, simulations: [] },
      ...overrides,
    };
  }

  it('recommends avalanche when the interest saving is above the threshold', () => {
    const result = recommendFocusDebt(comparison({ interestDifferenceSatang: AVALANCHE_MIN_INTEREST_SAVING_SATANG + 1 }));
    expect(result?.recommendedStrategy).toBe('avalanche');
    expect(result?.focusDebtId).toBe('high');
    expect(result?.reason).toContain('ลดดอกเบี้ยก่อน');
  });

  it('recommends snowball when the saving is below the threshold', () => {
    const result = recommendFocusDebt(comparison({ interestDifferenceSatang: AVALANCHE_MIN_INTEREST_SAVING_SATANG - 1 }));
    expect(result?.recommendedStrategy).toBe('snowball');
    expect(result?.focusDebtId).toBe('small');
    expect(result?.reason).toContain('ปิดก้อนเล็กก่อน');
  });

  it('recommends snowball exactly at the threshold boundary', () => {
    expect(recommendFocusDebt(comparison({ interestDifferenceSatang: AVALANCHE_MIN_INTEREST_SAVING_SATANG }))?.recommendedStrategy).toBe('snowball');
  });

  it('returns null with fewer than two active debts', () => {
    expect(recommendFocusDebt(comparison({ activeDebtCount: 1 }))).toBeNull();
    expect(recommendFocusDebt(comparison({ activeDebtCount: 0 }))).toBeNull();
  });
});
