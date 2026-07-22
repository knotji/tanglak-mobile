import { describe, expect, it } from 'vitest';
import { bahtToSatang, formatTHB, satangToBaht } from './money';

describe('satangToBaht', () => {
  it('divides by 100', () => {
    expect(satangToBaht(12345)).toBe(123.45);
    expect(satangToBaht(0)).toBe(0);
    expect(satangToBaht(-500)).toBe(-5);
  });
});

describe('bahtToSatang', () => {
  it('parses whole and fractional baht amounts', () => {
    expect(bahtToSatang('100')).toBe(10000);
    expect(bahtToSatang('99.99')).toBe(9999);
    expect(bahtToSatang('0.5')).toBe(50);
    expect(bahtToSatang('0.05')).toBe(5);
  });

  it('accepts a number input directly', () => {
    expect(bahtToSatang(42)).toBe(4200);
  });

  it('strips thousands separators', () => {
    expect(bahtToSatang('1,234.50')).toBe(123450);
  });

  it('preserves sign for negative amounts', () => {
    expect(bahtToSatang('-50')).toBe(-5000);
  });

  it('rejects more than two decimal places', () => {
    expect(() => bahtToSatang('1.234')).toThrow('Invalid baht amount');
  });

  it('rejects non-numeric input', () => {
    expect(() => bahtToSatang('abc')).toThrow('Invalid baht amount');
    expect(() => bahtToSatang('')).toThrow('Invalid baht amount');
  });
});

describe('formatTHB', () => {
  it('formats whole-number amounts with no decimal places', () => {
    expect(formatTHB(150000)).toBe('฿1,500');
  });

  it('formats fractional amounts with exactly two decimal places', () => {
    expect(formatTHB(150050)).toBe('฿1,500.50');
  });

  it('prefixes negative amounts with a minus sign', () => {
    expect(formatTHB(-5000)).toBe('-฿50');
  });

  it('omits a sign for positive amounts by default', () => {
    expect(formatTHB(5000)).toBe('฿50');
  });

  it('adds a plus sign for positive amounts when requested', () => {
    expect(formatTHB(5000, { showPositiveSign: true })).toBe('+฿50');
  });

  it('does not add a plus sign for zero even when requested', () => {
    expect(formatTHB(0, { showPositiveSign: true })).toBe('฿0');
  });

  it('normalizes negative zero to a plain zero', () => {
    expect(formatTHB(-0)).toBe('฿0');
  });

  it('rejects non-finite input', () => {
    expect(() => formatTHB(NaN)).toThrow('Invalid satang amount');
    expect(() => formatTHB(Infinity)).toThrow('Invalid satang amount');
  });
});
