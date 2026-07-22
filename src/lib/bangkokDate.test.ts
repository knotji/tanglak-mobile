import { describe, expect, it } from 'vitest';
import { bangkokMonthRange, currentBangkokMonth, nowBangkokDatetimeLocal, shiftBangkokMonth, todayBangkokRange } from './bangkokDate';

describe('todayBangkokRange', () => {
  it('returns a [start, end) pair 24 hours apart', () => {
    const { start, end } = todayBangkokRange(new Date('2026-07-11T10:00:00Z'));
    expect(new Date(end).getTime() - new Date(start).getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('anchors the range to the Bangkok calendar day, not the UTC day', () => {
    // 2026-07-10T20:00:00Z is 2026-07-11T03:00 in Bangkok (UTC+7) --
    // "today" must be the 11th, so start is 2026-07-10T17:00:00Z
    // (2026-07-11T00:00+07:00) and end is 24h after that.
    const { start, end } = todayBangkokRange(new Date('2026-07-10T20:00:00Z'));
    expect(start).toBe('2026-07-10T17:00:00.000Z');
    expect(end).toBe('2026-07-11T17:00:00.000Z');
  });
});

describe('nowBangkokDatetimeLocal', () => {
  it('renders the given instant as Bangkok wall-clock time', () => {
    expect(nowBangkokDatetimeLocal(new Date('2026-07-11T01:32:00Z'))).toBe('2026-07-11T08:32');
  });
});

describe('bangkokMonthRange', () => {
  it('spans the first through last instant of the given month', () => {
    const { start, end } = bangkokMonthRange('2026-07');
    expect(start).toBe('2026-07-01T00:00:00+07:00');
    expect(end).toBe('2026-08-01T00:00:00+07:00');
  });

  it('rolls the year over at December', () => {
    const { start, end } = bangkokMonthRange('2026-12');
    expect(start).toBe('2026-12-01T00:00:00+07:00');
    expect(end).toBe('2027-01-01T00:00:00+07:00');
  });
});

describe('currentBangkokMonth', () => {
  it('returns the YYYY-MM prefix of the given instant, in Bangkok time', () => {
    expect(currentBangkokMonth(new Date('2026-07-11T01:32:00Z'))).toBe('2026-07');
  });

  it('rolls the month forward when the UTC instant is still in the previous month', () => {
    // 2026-06-30T20:00:00Z is 2026-07-01T03:00 in Bangkok.
    expect(currentBangkokMonth(new Date('2026-06-30T20:00:00Z'))).toBe('2026-07');
  });
});

describe('shiftBangkokMonth', () => {
  it('shifts forward within the same year', () => {
    expect(shiftBangkokMonth('2026-07', 1)).toBe('2026-08');
  });

  it('shifts backward within the same year', () => {
    expect(shiftBangkokMonth('2026-07', -1)).toBe('2026-06');
  });

  it('rolls the year forward past December', () => {
    expect(shiftBangkokMonth('2026-12', 1)).toBe('2027-01');
  });

  it('rolls the year backward past January', () => {
    expect(shiftBangkokMonth('2026-01', -1)).toBe('2025-12');
  });

  it('supports multi-month jumps', () => {
    expect(shiftBangkokMonth('2026-07', 6)).toBe('2027-01');
    expect(shiftBangkokMonth('2026-07', -8)).toBe('2025-11');
  });

  it('is a no-op for delta 0', () => {
    expect(shiftBangkokMonth('2026-07', 0)).toBe('2026-07');
  });
});
