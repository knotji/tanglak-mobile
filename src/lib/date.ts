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

/**
 * Converts an ISO instant (Bangkok wall-clock digits with an explicit
 * +07:00 offset, e.g. from AI extraction, OR a UTC instant with a Z/+00:00
 * offset, e.g. whatever Supabase/PostgREST returns for a `timestamptz`
 * column) into a Bangkok wall-clock "YYYY-MM-DDTHH:mm" string.
 *
 * Do NOT replace this with naive string-slicing of the ISO digits
 * (`iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/)`) -- that only happens
 * to be correct when the source string's offset is already +07:00. A
 * value read back from the database is UTC, so slicing its raw digits
 * silently shows a time 7 hours earlier than the real Bangkok time (bug
 * found via a slip that displayed "01:32" for what was actually an 08:32
 * purchase). `new Date(iso)` resolves to the correct instant regardless
 * of the source offset notation, so adding +7h from there is correct in
 * both cases.
 */
export function isoInstantToBangkokDatetimeLocal(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return '';
  const bangkok = new Date(instant.getTime() + 7 * 60 * 60 * 1000);
  const y = bangkok.getUTCFullYear();
  const m = String(bangkok.getUTCMonth() + 1).padStart(2, '0');
  const d = String(bangkok.getUTCDate()).padStart(2, '0');
  const h = String(bangkok.getUTCHours()).padStart(2, '0');
  const min = String(bangkok.getUTCMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
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

/** e.g. "กรกฎาคม 2026" -- Thai month name + Gregorian year, for a month picker/header. `month` is "YYYY-MM". */
export function formatThaiMonthYearLabel(month: string): string | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;
  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (monthNumber < 1 || monthNumber > 12) return null;
  const date = new Date(Date.UTC(year, monthNumber - 1, 1));
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(date);
}

/**
 * "18 ก.ค." (day + month, no year -- day/month are the same regardless of
 * Buddhist vs Gregorian calendar, so no -u-ca-gregory override is needed
 * here the way formatThaiDateLabel/formatThaiDateTimeLabel need one).
 * Ported from tanglak's TransactionGroup.tsx dayLabel, day-group header use.
 */
export function formatThaiDayMonthLabel(dateKey: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return new Intl.DateTimeFormat('th-TH', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(date);
}
