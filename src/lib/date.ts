// Ported from tanglak/src/lib/finance/date.ts (parseWallClockComponents,
// formatThaiDateTimeLabel) -- the native `datetime-local` input's own
// rendering is locale-dependent (this browser shows MM/DD/YYYY, which
// reads ambiguously in Thai even when the underlying value is correct).
// This produces an unambiguous label alongside the input instead.
const DATETIME_LOCAL_PATTERN = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;

interface WallClockParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

export function parseWallClockComponents(value: string): WallClockParts | null {
  const match = DATETIME_LOCAL_PATTERN.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  if (month < 1 || month > 12) return null;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  if (day < 1 || day > daysInMonth) return null;
  if (hour > 23 || minute > 59) return null;
  return { year, month, day, hour, minute };
}

/** e.g. "5 ก.ค. 2026 เวลา 13:44" -- Thai language, Gregorian calendar (not Buddhist era), no timezone conversion. */
export function formatThaiDateTimeLabel(value: string): string | null {
  const parts = parseWallClockComponents(value);
  if (!parts) return null;
  const dateLabel = new Intl.DateTimeFormat('th-TH-u-ca-gregory', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(Date.UTC(parts.year, parts.month - 1, parts.day)));
  const timeLabel = `${String(parts.hour).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`;
  return `${dateLabel} เวลา ${timeLabel}`;
}

/** e.g. "5 ก.ค. 2026" -- date-only counterpart of formatThaiDateTimeLabel, for date (no time) fields like a debt's due date. */
export function formatThaiDateLabel(dateKey: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}
