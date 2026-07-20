// Ported from tanglak/src/lib/finance/money.ts.
export function satangToBaht(satang: number): number {
  return satang / 100;
}

function normalizeSatang(satang: number): number {
  return Object.is(satang, -0) ? 0 : satang;
}

export function formatTHB(satang: number, options: { showPositiveSign?: boolean } = {}): string {
  if (!Number.isFinite(satang)) throw new Error('Invalid satang amount');
  const normalized = normalizeSatang(satang);
  const sign = normalized < 0 ? '-' : options.showPositiveSign && normalized > 0 ? '+' : '';
  const amount = new Intl.NumberFormat('th-TH', {
    maximumFractionDigits: normalized % 100 === 0 ? 0 : 2,
  }).format(Math.abs(satangToBaht(normalized)));
  return `${sign}฿${amount}`;
}
