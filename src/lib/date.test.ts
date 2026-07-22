import { describe, expect, it } from 'vitest';
import {
  formatThaiDateLabel,
  formatThaiDateTimeLabel,
  formatThaiDayMonthLabel,
  formatThaiMonthYearLabel,
  isoInstantToBangkokDatetimeLocal,
  parseWallClockComponents,
} from './date';

describe('parseWallClockComponents', () => {
  it('parses a valid datetime-local string', () => {
    expect(parseWallClockComponents('2026-07-05T13:44')).toEqual({ year: 2026, month: 7, day: 5, hour: 13, minute: 44 });
  });

  it('rejects a malformed string', () => {
    expect(parseWallClockComponents('2026-07-05')).toBeNull();
    expect(parseWallClockComponents('not-a-date')).toBeNull();
  });

  it('rejects an impossible calendar date', () => {
    expect(parseWallClockComponents('2026-02-30T12:00')).toBeNull();
    expect(parseWallClockComponents('2026-13-01T12:00')).toBeNull();
  });

  it('accepts Feb 29 on a leap year but not a non-leap year', () => {
    expect(parseWallClockComponents('2024-02-29T12:00')).toEqual({ year: 2024, month: 2, day: 29, hour: 12, minute: 0 });
    expect(parseWallClockComponents('2026-02-29T12:00')).toBeNull();
  });

  it('rejects an out-of-range hour or minute', () => {
    expect(parseWallClockComponents('2026-07-05T24:00')).toBeNull();
    expect(parseWallClockComponents('2026-07-05T13:60')).toBeNull();
  });
});

describe('isoInstantToBangkokDatetimeLocal', () => {
  // This is the function that replaced the digit-slicing bug: a slip
  // showing an implausible "01:32" turned out to actually be 08:32,
  // because Supabase returns UTC and the old code treated those UTC
  // digits as if they were already Bangkok wall-clock time.
  it('converts a UTC instant to Bangkok wall-clock time (+7h)', () => {
    expect(isoInstantToBangkokDatetimeLocal('2026-07-11T01:32:00Z')).toBe('2026-07-11T08:32');
  });

  it('resolves the same instant regardless of the source offset notation', () => {
    // 08:32+07:00 and 01:32Z name the same absolute instant -- both must
    // produce the identical Bangkok wall-clock result.
    expect(isoInstantToBangkokDatetimeLocal('2026-07-11T08:32:00+07:00')).toBe('2026-07-11T08:32');
    expect(isoInstantToBangkokDatetimeLocal('2026-07-11T01:32:00Z')).toBe(
      isoInstantToBangkokDatetimeLocal('2026-07-11T08:32:00+07:00'),
    );
  });

  it('rolls the calendar date forward when +7h crosses midnight', () => {
    expect(isoInstantToBangkokDatetimeLocal('2026-07-10T20:00:00Z')).toBe('2026-07-11T03:00');
  });

  it('rolls the calendar month/year forward at a month/year boundary', () => {
    expect(isoInstantToBangkokDatetimeLocal('2025-12-31T18:00:00Z')).toBe('2026-01-01T01:00');
  });

  it('returns an empty string for an unparseable instant', () => {
    expect(isoInstantToBangkokDatetimeLocal('not-a-date')).toBe('');
  });
});

describe('formatThaiDateTimeLabel', () => {
  it('formats a wall-clock string with a Gregorian year (not Buddhist era)', () => {
    expect(formatThaiDateTimeLabel('2026-07-05T13:44')).toBe('5 ก.ค. 2026 เวลา 13:44');
  });

  it('returns null for an invalid wall-clock string', () => {
    expect(formatThaiDateTimeLabel('garbage')).toBeNull();
  });
});

describe('formatThaiDateLabel', () => {
  it('formats a date-only key with a Gregorian year', () => {
    expect(formatThaiDateLabel('2026-07-05')).toBe('5 ก.ค. 2026');
  });

  it('returns null for an impossible calendar date', () => {
    expect(formatThaiDateLabel('2026-02-30')).toBeNull();
  });

  it('returns null for a malformed key', () => {
    expect(formatThaiDateLabel('2026-7-5')).toBeNull();
    expect(formatThaiDateLabel('')).toBeNull();
  });
});

describe('formatThaiMonthYearLabel', () => {
  it('formats a YYYY-MM key with a Gregorian year', () => {
    expect(formatThaiMonthYearLabel('2026-07')).toBe('กรกฎาคม 2026');
  });

  it('returns null for an out-of-range month', () => {
    expect(formatThaiMonthYearLabel('2026-13')).toBeNull();
    expect(formatThaiMonthYearLabel('2026-00')).toBeNull();
  });

  it('returns null for a malformed key', () => {
    expect(formatThaiMonthYearLabel('2026')).toBeNull();
  });
});

describe('formatThaiDayMonthLabel', () => {
  it('formats a date key as day + short month, no year', () => {
    expect(formatThaiDayMonthLabel('2026-07-18')).toBe('18 ก.ค.');
  });

  it('returns null for a malformed key', () => {
    expect(formatThaiDayMonthLabel('18-07-2026')).toBeNull();
  });
});
