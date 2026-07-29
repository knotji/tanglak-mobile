import { describe, expect, it } from 'vitest';
import { calculateDailySpendLimit } from './dailySpendLimit';

// Fix "now" to a known Bangkok date so days-remaining-in-month math is deterministic:
// 2026-07-10 08:00 UTC = 2026-07-10 15:00 Bangkok, day 10 of a 31-day month -> 22 days remaining.
const FIXED_NOW = new Date('2026-07-10T08:00:00Z');

describe('calculateDailySpendLimit', () => {
  it('does not fabricate income -- zero planned income means zero budget, not a hidden default', () => {
    const result = calculateDailySpendLimit(0, 0, 0, FIXED_NOW);
    expect(result.hasPlannedIncome).toBe(false);
    expect(result.dailyLimitSatang).toBe(0);
    expect(result.remainingTodaySatang).toBe(0);
    expect(result.percentageUsedToday).toBe(0);
    expect(result.statusText).toBe('ยังไม่ได้ตั้งงบรายรับ');
  });

  it('splits available income evenly across remaining days', () => {
    const result = calculateDailySpendLimit(0, 0, 3000000, FIXED_NOW);
    expect(result.hasPlannedIncome).toBe(true);
    expect(result.daysRemainingInMonth).toBe(22);
    expect(result.dailyLimitSatang).toBe(Math.round(3000000 / 22));
  });

  it('subtracts spend from earlier in the month before dividing by days remaining', () => {
    const monthSpentSatang = 1000000; // 10,000.00 spent so far this month (incl. today)
    const todaySpentSatang = 20000; // 200.00 spent today
    const result = calculateDailySpendLimit(monthSpentSatang, todaySpentSatang, 3000000, FIXED_NOW);
    const spentBeforeToday = monthSpentSatang - todaySpentSatang;
    expect(result.dailyLimitSatang).toBe(Math.round((3000000 - spentBeforeToday) / 22));
  });

  it('flags over-budget when todaySpent exceeds the computed daily limit', () => {
    const result = calculateDailySpendLimit(0, 100000, 22000, FIXED_NOW); // limit = 1000/day, spent 1000.00 today
    expect(result.remainingTodaySatang).toBeLessThan(0);
    expect(result.statusText).toBe('เกินงบประจำวัน');
  });

  it('never lets remaining budget go negative before dividing', () => {
    const result = calculateDailySpendLimit(5000000, 0, 1000000, FIXED_NOW);
    expect(result.dailyLimitSatang).toBe(0);
  });
});
