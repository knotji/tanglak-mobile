import { describe, expect, it } from 'vitest';
import {
  addOneDay,
  daysInMonth,
  daysUntilDue,
  debtDueStatus,
  formatInterestRateSummary,
  nextDueDate,
  paymentProgress,
  previewCycleAdvance,
  remainingToMinimum,
  shiftDateKeyByOneMonth,
  shouldAutoAdvance,
  type Debt,
} from './debts';

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: 'debt-1',
    name: 'Test debt',
    creditor: null,
    outstandingBalanceSatang: 100000,
    amountDueSatang: 100000,
    minimumPaymentSatang: 100000,
    amountPaidThisCycleSatang: 0,
    dueDate: '2026-07-18',
    recurringDueDay: null,
    cycleStartDate: null,
    cycleEndDate: null,
    paymentMode: 'variable_monthly',
    interestRateAnnual: null,
    notes: null,
    status: 'active',
    ...overrides,
  };
}

describe('remainingToMinimum', () => {
  it('returns the gap between the minimum and what has been paid', () => {
    expect(remainingToMinimum(makeDebt({ minimumPaymentSatang: 1000, amountPaidThisCycleSatang: 300 }))).toBe(700);
  });

  it('never goes negative once the minimum is exceeded', () => {
    expect(remainingToMinimum(makeDebt({ minimumPaymentSatang: 1000, amountPaidThisCycleSatang: 1500 }))).toBe(0);
  });

  it('treats a missing minimum as zero owed', () => {
    expect(remainingToMinimum(makeDebt({ minimumPaymentSatang: null, amountPaidThisCycleSatang: 100 }))).toBe(0);
  });
});

describe('paymentProgress', () => {
  it('is the ratio of paid to the minimum target', () => {
    expect(paymentProgress(makeDebt({ minimumPaymentSatang: 1000, amountPaidThisCycleSatang: 500 }))).toBe(0.5);
  });

  it('falls back to amountDue when minimum is not set', () => {
    expect(paymentProgress(makeDebt({ minimumPaymentSatang: null, amountDueSatang: 2000, amountPaidThisCycleSatang: 2000 }))).toBe(1);
  });

  it('caps at 1 even when overpaid', () => {
    expect(paymentProgress(makeDebt({ minimumPaymentSatang: 1000, amountPaidThisCycleSatang: 1500 }))).toBe(1);
  });

  it('treats a zero/missing target as fully progressed', () => {
    expect(paymentProgress(makeDebt({ minimumPaymentSatang: 0, amountDueSatang: 0, amountPaidThisCycleSatang: 0 }))).toBe(1);
  });
});

describe('daysUntilDue', () => {
  const today = new Date('2026-07-11T04:00:00Z'); // 11:00 in Bangkok, safely mid-day

  it('is 0 for a due date that is today', () => {
    expect(daysUntilDue('2026-07-11', today)).toBe(0);
  });

  it('is positive for a future due date', () => {
    expect(daysUntilDue('2026-07-15', today)).toBe(4);
  });

  it('is negative for a past due date', () => {
    expect(daysUntilDue('2026-07-05', today)).toBe(-6);
  });

  it('anchors "today" to the Bangkok calendar day, not the UTC day', () => {
    // 2026-07-10T20:00:00Z is 2026-07-11T03:00 in Bangkok -- "today" must
    // be the 11th, so a due date of the 11th is 0 days away, not 1.
    const utcLateNight = new Date('2026-07-10T20:00:00Z');
    expect(daysUntilDue('2026-07-11', utcLateNight)).toBe(0);
  });
});

describe('debtDueStatus', () => {
  const today = new Date('2026-07-11T04:00:00Z');

  it('is cycle_paid_in_full once the full amount due is paid, regardless of date', () => {
    const debt = makeDebt({ amountDueSatang: 1000, amountPaidThisCycleSatang: 1000, dueDate: '2026-07-05' });
    expect(debtDueStatus(debt, today)).toBe('cycle_paid_in_full');
  });

  it('is minimum_paid once the minimum is met but not the full amount', () => {
    const debt = makeDebt({ amountDueSatang: 1000, minimumPaymentSatang: 500, amountPaidThisCycleSatang: 600 });
    expect(debtDueStatus(debt, today)).toBe('minimum_paid');
  });

  it('is not_yet_due when there is no due date at all', () => {
    const debt = makeDebt({ amountDueSatang: 1000, minimumPaymentSatang: 500, amountPaidThisCycleSatang: 0, dueDate: null });
    expect(debtDueStatus(debt, today)).toBe('not_yet_due');
  });

  it('is due_today when the due date is today', () => {
    const debt = makeDebt({ amountDueSatang: 1000, minimumPaymentSatang: 500, amountPaidThisCycleSatang: 0, dueDate: '2026-07-11' });
    expect(debtDueStatus(debt, today)).toBe('due_today');
  });

  it('is due_soon within the 3-day window', () => {
    const debt = makeDebt({ amountDueSatang: 1000, minimumPaymentSatang: 500, amountPaidThisCycleSatang: 0, dueDate: '2026-07-13' });
    expect(debtDueStatus(debt, today)).toBe('due_soon');
  });

  it('is not_yet_due just outside the 3-day window', () => {
    const debt = makeDebt({ amountDueSatang: 1000, minimumPaymentSatang: 500, amountPaidThisCycleSatang: 0, dueDate: '2026-07-15' });
    expect(debtDueStatus(debt, today)).toBe('not_yet_due');
  });

  it('is overdue once the due date has passed with nothing paid', () => {
    const debt = makeDebt({ amountDueSatang: 1000, minimumPaymentSatang: 500, amountPaidThisCycleSatang: 0, dueDate: '2026-07-08' });
    expect(debtDueStatus(debt, today)).toBe('overdue');
  });
});

describe('formatInterestRateSummary', () => {
  it('includes both the annual rate and a derived monthly rate', () => {
    expect(formatInterestRateSummary(16.5)).toBe('ดอกเบี้ย 16.5% ต่อปี (ประมาณ 1.38% ต่อเดือน)');
  });

  it('drops a trailing .00 when the monthly rate is a whole number', () => {
    expect(formatInterestRateSummary(12)).toBe('ดอกเบี้ย 12% ต่อปี (ประมาณ 1% ต่อเดือน)');
  });
});

describe('shiftDateKeyByOneMonth', () => {
  it('shifts the month forward within the same year', () => {
    expect(shiftDateKeyByOneMonth('2026-07-18')).toBe('2026-08-18');
  });

  it('rolls the year over at December', () => {
    expect(shiftDateKeyByOneMonth('2026-12-15')).toBe('2027-01-15');
  });

  it('clamps the day when the target month is shorter (non-leap February)', () => {
    expect(shiftDateKeyByOneMonth('2026-01-31')).toBe('2026-02-28');
  });

  it('clamps to the 29th in a leap-year February', () => {
    expect(shiftDateKeyByOneMonth('2024-01-31')).toBe('2024-02-29');
  });

  it('clamps the day for a 30-day target month', () => {
    expect(shiftDateKeyByOneMonth('2026-03-31')).toBe('2026-04-30');
  });
});

describe('nextDueDate', () => {
  it('falls back to shiftDateKeyByOneMonth when there is no recurring day', () => {
    expect(nextDueDate('2026-07-18', null)).toBe('2026-08-18');
  });

  it('uses the recurring day instead of the original day-of-month', () => {
    expect(nextDueDate('2026-07-18', 5)).toBe('2026-08-05');
  });

  it('clamps the recurring day to the target month length', () => {
    expect(nextDueDate('2026-01-15', 31)).toBe('2026-02-28');
  });

  it('rolls the year over at December with a recurring day set', () => {
    expect(nextDueDate('2026-12-10', 15)).toBe('2027-01-15');
  });
});

describe('addOneDay', () => {
  it('increments within the same month', () => {
    expect(addOneDay('2026-07-18')).toBe('2026-07-19');
  });

  it('rolls over into the next month', () => {
    expect(addOneDay('2026-07-31')).toBe('2026-08-01');
  });

  it('rolls over into the next year', () => {
    expect(addOneDay('2026-12-31')).toBe('2027-01-01');
  });

  it('handles the Feb 28 -> 29 leap-year boundary', () => {
    expect(addOneDay('2024-02-28')).toBe('2024-02-29');
  });

  it('handles the Feb 28 -> Mar 1 non-leap-year boundary', () => {
    expect(addOneDay('2026-02-28')).toBe('2026-03-01');
  });
});

describe('daysInMonth', () => {
  it('returns 28 for a non-leap February', () => {
    expect(daysInMonth(2026, 2)).toBe(28);
  });

  it('returns 29 for a leap February', () => {
    expect(daysInMonth(2024, 2)).toBe(29);
  });

  it('returns 30 and 31 for other months', () => {
    expect(daysInMonth(2026, 4)).toBe(30);
    expect(daysInMonth(2026, 1)).toBe(31);
  });
});

describe('previewCycleAdvance', () => {
  it('returns null when the debt has no due date', () => {
    expect(previewCycleAdvance(makeDebt({ dueDate: null }))).toBeNull();
  });

  it('previews the plain one-month shift when there is no recurring day', () => {
    expect(previewCycleAdvance(makeDebt({ dueDate: '2026-07-18', recurringDueDay: null }))).toEqual({
      previousDueDate: '2026-07-18',
      nextDueDate: '2026-08-18',
    });
  });

  it('previews using the recurring day when set', () => {
    expect(previewCycleAdvance(makeDebt({ dueDate: '2026-07-05', recurringDueDay: 20 }))).toEqual({
      previousDueDate: '2026-07-05',
      nextDueDate: '2026-08-20',
    });
  });
});

describe('shouldAutoAdvance', () => {
  // Distant fixed dates keep this deterministic without faking the clock:
  // one is unambiguously in the past and the other unambiguously in the future.
  const PAST_DUE = '2000-01-01';
  const FUTURE_DUE = '2999-01-01';

  it('is false with no due date', () => {
    expect(shouldAutoAdvance(makeDebt({ dueDate: null, amountDueSatang: 1000, amountPaidThisCycleSatang: 1000 }))).toBe(false);
  });

  it('is false when there is no amount due to compare against', () => {
    expect(shouldAutoAdvance(makeDebt({ dueDate: PAST_DUE, amountDueSatang: null, amountPaidThisCycleSatang: 1000 }))).toBe(false);
    expect(shouldAutoAdvance(makeDebt({ dueDate: PAST_DUE, amountDueSatang: 0, amountPaidThisCycleSatang: 0 }))).toBe(false);
  });

  it('is false when the cycle is not fully paid, even if overdue', () => {
    expect(shouldAutoAdvance(makeDebt({ dueDate: PAST_DUE, amountDueSatang: 1000, amountPaidThisCycleSatang: 500 }))).toBe(false);
  });

  it('is false when fully paid but not yet overdue', () => {
    expect(shouldAutoAdvance(makeDebt({ dueDate: FUTURE_DUE, amountDueSatang: 1000, amountPaidThisCycleSatang: 1000 }))).toBe(false);
  });

  it('is true only when fully paid AND overdue', () => {
    expect(shouldAutoAdvance(makeDebt({ dueDate: PAST_DUE, amountDueSatang: 1000, amountPaidThisCycleSatang: 1000 }))).toBe(true);
  });
});
