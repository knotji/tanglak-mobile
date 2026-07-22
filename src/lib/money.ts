// Ported from tanglak/src/lib/finance/money.ts.
export function satangToBaht(satang: number): number {
  return satang / 100;
}

export function bahtToSatang(value: string | number): number {
  const normalized = String(value).replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid baht amount');
  const [bahtPart, satangPart = ''] = normalized.split('.');
  const sign = bahtPart.startsWith('-') ? -1 : 1;
  const absoluteBaht = Math.abs(Number(bahtPart));
  const satang = Number(satangPart.padEnd(2, '0'));
  return sign * (absoluteBaht * 100 + satang);
}

function normalizeSatang(satang: number): number {
  return Object.is(satang, -0) ? 0 : satang;
}

export function formatTHB(satang: number, options: { showPositiveSign?: boolean } = {}): string {
  if (!Number.isFinite(satang)) throw new Error('Invalid satang amount');
  const normalized = normalizeSatang(satang);
  const sign = normalized < 0 ? '-' : options.showPositiveSign && normalized > 0 ? '+' : '';
  // minimumFractionDigits must match maximumFractionDigits here -- with only
  // a max set, Intl.NumberFormat trims trailing zeros, so a value like
  // 1500.50 baht rendered as "1,500.5" instead of "1,500.50" (caught by a
  // test; same latent bug exists in tanglak's own src/lib/finance/money.ts).
  const digits = normalized % 100 === 0 ? 0 : 2;
  const amount = new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Math.abs(satangToBaht(normalized)));
  return `${sign}฿${amount}`;
}
