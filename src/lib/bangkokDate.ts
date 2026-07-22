// Bangkok is a fixed UTC+7 offset app-wide (no DST since 1920) -- same
// convention as tanglak/src/lib/ai/timestamp.ts and date.ts. Returns
// today's [start, end) as ISO instants for a `.gte`/`.lt` range query,
// computed from the device clock's UTC time rather than the device's own
// (possibly non-Bangkok) local timezone.
export function todayBangkokRange(now: Date = new Date()): { start: string; end: string } {
  const bangkokMs = now.getTime() + 7 * 60 * 60 * 1000;
  const bangkok = new Date(bangkokMs);
  const y = bangkok.getUTCFullYear();
  const m = bangkok.getUTCMonth();
  const d = bangkok.getUTCDate();
  const startUtcMs = Date.UTC(y, m, d, 0, 0, 0) - 7 * 60 * 60 * 1000;
  const endUtcMs = startUtcMs + 24 * 60 * 60 * 1000;
  return { start: new Date(startUtcMs).toISOString(), end: new Date(endUtcMs).toISOString() };
}

/** Current Bangkok wall-clock time as a `datetime-local` input default value. */
export function nowBangkokDatetimeLocal(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

/** [start, end) ISO instants for a Bangkok calendar month (`YYYY-MM`), for a `.gte`/`.lt` range query. */
export function bangkokMonthRange(month: string): { start: string; end: string } {
  const [year, monthNumber] = month.split('-').map(Number);
  const start = `${month}-01T00:00:00+07:00`;
  const nextMonth = monthNumber === 12 ? `${year + 1}-01` : `${year}-${String(monthNumber + 1).padStart(2, '0')}`;
  const end = `${nextMonth}-01T00:00:00+07:00`;
  return { start, end };
}

/** Current Bangkok calendar month as `YYYY-MM`. */
export function currentBangkokMonth(now: Date = new Date()): string {
  return nowBangkokDatetimeLocal(now).slice(0, 7);
}

/** `month` ("YYYY-MM") shifted by `delta` whole calendar months (may be negative). */
export function shiftBangkokMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  const nextYear = Math.floor(total / 12);
  const nextMonth = (total % 12) + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}`;
}
