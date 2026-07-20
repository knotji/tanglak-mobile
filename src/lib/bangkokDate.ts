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
