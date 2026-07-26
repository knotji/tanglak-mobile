import { supabase } from '@/lib/supabaseClient';
import { bahtToSatang } from '@/lib/money';
import { advanceDebtCycle } from '@/lib/debtCycleAdvance';

// Re-exported so existing call sites (13 files) don't need to change their
// import path after this file was split into debts.ts (CRUD/reads, this
// file), debtStatus.ts (pure status/progress calculations), and
// debtCycleAdvance.ts (cycle-advance writes) -- matches the web app's own
// file layout (tanglak/src/lib/finance/{calculations,debt-status,debt-interest}.ts).
import { daysUntilDue } from '@/lib/debtStatus';
export {
  remainingToMinimum,
  paymentProgress,
  daysUntilDue,
  debtDueStatus,
  formatInterestRateSummary,
  DEBT_DUE_STATUS_LABEL_TH,
  type DebtDueStatus,
} from '@/lib/debtStatus';
export {
  daysInMonth,
  shiftDateKeyByOneMonth,
  nextDueDate,
  addOneDay,
  previewCycleAdvance,
  advanceDebtCycle,
  type CycleAdvancePreview,
} from '@/lib/debtCycleAdvance';

export interface Debt {
  id: string;
  name: string;
  creditor: string | null;
  outstandingBalanceSatang: number | null;
  amountDueSatang: number | null;
  minimumPaymentSatang: number | null;
  amountPaidThisCycleSatang: number;
  dueDate: string | null;
  recurringDueDay: number | null;
  cycleStartDate: string | null;
  cycleEndDate: string | null;
  paymentMode: 'fixed_monthly' | 'variable_monthly' | 'installment' | 'one_time';
  interestRateAnnual: number | null;
  notes: string | null;
  status: string;
}

interface DebtRow {
  id: string;
  name: string;
  creditor: string | null;
  outstanding_balance_satang: number | null;
  amount_due_satang: number | null;
  minimum_payment_satang: number | null;
  amount_paid_this_cycle_satang: number;
  due_date: string | null;
  recurring_due_day: number | null;
  cycle_start_date: string | null;
  cycle_end_date: string | null;
  payment_mode: Debt['paymentMode'] | null;
  interest_rate_annual: number | null;
  notes: string | null;
  status: string;
}

const COLUMNS =
  'id, name, creditor, outstanding_balance_satang, amount_due_satang, minimum_payment_satang, amount_paid_this_cycle_satang, due_date, recurring_due_day, cycle_start_date, cycle_end_date, payment_mode, interest_rate_annual, notes, status';

function mapRow(row: DebtRow): Debt {
  return {
    id: row.id,
    name: row.name,
    creditor: row.creditor,
    outstandingBalanceSatang: row.outstanding_balance_satang,
    amountDueSatang: row.amount_due_satang,
    minimumPaymentSatang: row.minimum_payment_satang,
    amountPaidThisCycleSatang: Number(row.amount_paid_this_cycle_satang),
    dueDate: row.due_date,
    recurringDueDay: row.recurring_due_day,
    cycleStartDate: row.cycle_start_date,
    cycleEndDate: row.cycle_end_date,
    paymentMode: row.payment_mode ?? 'variable_monthly',
    interestRateAnnual: row.interest_rate_annual,
    notes: row.notes,
    status: row.status,
  };
}

async function fetchDebtRows(): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select(COLUMNS)
    .neq('status', 'deleted')
    .neq('status', 'paid_off')
    .order('due_date', { ascending: true });
  if (error) throw new Error('โหลดรายการหนี้ไม่สำเร็จ');
  return (data ?? []).map(mapRow);
}

/**
 * Auto-advance only when the current cycle is already fully paid AND the
 * due date has passed -- there is nothing left to signal by staying put
 * (the minimum/full amount is met), so rolling it forward is pure
 * bookkeeping. An unpaid/overdue cycle is never auto-advanced -- that
 * would hide money still owed, which is exactly the "never silently
 * transition financial state" rule the rest of this app follows. See
 * advanceDebtCycle for the "เริ่มรอบใหม่" manual button this reuses --
 * both paths share the same write, this just decides when to trigger it
 * without the user tapping anything.
 */
export function shouldAutoAdvance(debt: Debt): boolean {
  if (!debt.dueDate) return false;
  if (debt.amountDueSatang === null || debt.amountDueSatang <= 0) return false;
  if (debt.amountPaidThisCycleSatang < debt.amountDueSatang) return false;
  return daysUntilDue(debt.dueDate) < 0;
}

// listDebts() is called from nearly every page that touches debts (Today,
// Overview, Debts, Upload, DebtSimulate, DebtStrategy, Settings), and each
// call independently re-checks every debt for auto-advance eligibility --
// correct, but wasteful: a debt that was already advanced (or attempted)
// this session doesn't need re-checking on every single tab switch. This
// session-lifetime set (cleared on full app reload, never persisted) skips
// a debt once its auto-advance has been attempted, so navigating between
// debt-adjacent pages doesn't re-trigger the same write+reread every time.
const autoAdvanceAttemptedThisSession = new Set<string>();

/** Matches tanglak's listDebts default (includeClosed=false): excludes deleted and paid_off. Auto-advances any debt whose cycle is fully paid and past due before returning (see shouldAutoAdvance). */
export async function listDebts(): Promise<Debt[]> {
  const debts = await fetchDebtRows();
  const toAdvance = debts.filter((debt) => shouldAutoAdvance(debt) && !autoAdvanceAttemptedThisSession.has(debt.id));
  if (toAdvance.length === 0) return debts;

  for (const debt of toAdvance) {
    autoAdvanceAttemptedThisSession.add(debt.id);
    try {
      await advanceDebtCycle(debt);
    } catch {
      // Best-effort: a failed auto-advance (e.g. a transient network blip)
      // should never block the user from seeing their debt list. Retried on
      // the next full app launch (this session-lifetime guard only skips
      // re-attempting within the same session, not permanently).
    }
  }
  return fetchDebtRows();
}

export async function getDebtById(id: string): Promise<Debt | null> {
  const { data, error } = await supabase.from('debts').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error('โหลดข้อมูลหนี้ไม่สำเร็จ');
  return data ? mapRow(data) : null;
}

function normalizeForMatch(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Best-effort match from a scanned slip's merchant/payee name to one of the
 * user's existing debts, for pre-selecting the "หนี้ที่จะจ่าย" picker on a
 * debt_payment entry (previously always left blank -- the user had to pick
 * manually every time, even when the AI had already read a name that
 * unambiguously matched an existing debt).
 *
 * Deliberately conservative: only returns a match when exactly one debt's
 * name or creditor matches, never guesses between two candidates. Picking
 * the wrong debt would misattribute a real payment -- silently wrong is
 * worse than not pre-filled at all, consistent with this app's rule against
 * silent financial state changes (see shouldAutoAdvance above).
 */
export function findDebtForMerchant(merchantName: string, debts: Debt[]): Debt | null {
  if (!merchantName) return null;
  const normalized = normalizeForMatch(merchantName);
  if (!normalized) return null;

  const candidates = (field: (debt: Debt) => string | null) =>
    debts.filter((debt) => {
      const value = field(debt);
      if (!value) return false;
      const normalizedField = normalizeForMatch(value);
      return normalizedField === normalized || normalized.includes(normalizedField) || normalizedField.includes(normalized);
    });

  const byName = candidates((debt) => debt.name);
  if (byName.length === 1) return byName[0];

  const byCreditor = candidates((debt) => debt.creditor);
  if (byCreditor.length === 1) return byCreditor[0];

  return null;
}

// --- Create/update/delete. No Edge Function needed here: every invariant
// that matters (nonnegative money columns, minimum_payment_satang <=
// outstanding_balance_satang, interest rate 0-100, due_date a real
// calendar date, recurring_due_day 1-31) is enforced by Postgres CHECK
// constraints on the `debts` table itself (see
// tanglak/supabase/migrations/202607110001_financial_value_guards.sql,
// 202607110006_debt_interest_rate_guard.sql,
// 202607110008_debt_minimum_not_above_outstanding.sql) -- unlike a debt
// PAYMENT, creating/editing/deleting a debt row has no cross-row derived
// aggregate to keep in sync, so RLS + these constraints are already the
// real server-side backstop. Client-side validation below exists only for
// fast, friendly error messages before round-tripping to Postgres. ---

export const DEBT_ERROR_MINIMUM_ABOVE_OUTSTANDING_TH = 'ยอดขั้นต่ำต้องไม่มากกว่ายอดหนี้ทั้งหมด';
export const DEBT_ERROR_DUE_DATE_INVALID_TH = 'วันครบกำหนดไม่ถูกต้อง';

export interface DebtFormInput {
  name: string;
  creditor?: string;
  outstanding?: string;
  amountDue: string;
  minimum?: string;
  dueDate: string;
  recurringDueDay?: string;
  paymentMode?: 'fixed_monthly' | 'variable_monthly' | 'installment' | 'one_time';
  interestRateAnnual?: string;
  notes?: string;
}

function isValidDueDate(raw: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return false;
  const [, yearStr, monthStr, dayStr] = match;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseOptionalSatang(raw: string | undefined): number | undefined {
  if (raw === undefined || raw.trim() === '') return undefined;
  const satang = bahtToSatang(raw);
  if (!Number.isFinite(satang) || satang < 0) throw new Error('จำนวนเงินต้องไม่ติดลบ');
  return satang;
}

function buildDebtRow(input: DebtFormInput): Record<string, unknown> {
  if (!input.name.trim()) throw new Error('กรุณาระบุชื่อหนี้');
  if (!isValidDueDate(input.dueDate)) throw new Error(DEBT_ERROR_DUE_DATE_INVALID_TH);

  const amountDueSatang = bahtToSatang(input.amountDue);
  if (!Number.isFinite(amountDueSatang) || amountDueSatang < 0) throw new Error('จำนวนเงินต้องไม่ติดลบ');
  const outstandingSatang = parseOptionalSatang(input.outstanding) ?? amountDueSatang;
  const minimumSatang = parseOptionalSatang(input.minimum) ?? amountDueSatang;
  if (minimumSatang > outstandingSatang) throw new Error(DEBT_ERROR_MINIMUM_ABOVE_OUTSTANDING_TH);

  let interestRateAnnual: number | undefined;
  if (input.interestRateAnnual && input.interestRateAnnual.trim() !== '') {
    const rate = Number(input.interestRateAnnual);
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('อัตราดอกเบี้ยไม่ถูกต้อง');
    interestRateAnnual = rate;
  }

  let recurringDueDay: number | undefined;
  if (input.recurringDueDay && input.recurringDueDay.trim() !== '') {
    const day = Number(input.recurringDueDay);
    if (!Number.isInteger(day) || day < 1 || day > 31) throw new Error('วันครบกำหนดประจำเดือนไม่ถูกต้อง (1-31)');
    recurringDueDay = day;
  }

  return {
    name: input.name.trim(),
    creditor: input.creditor?.trim() || null,
    outstanding_balance_satang: outstandingSatang,
    amount_due_satang: amountDueSatang,
    minimum_payment_satang: minimumSatang,
    due_date: input.dueDate,
    recurring_due_day: recurringDueDay ?? null,
    payment_mode: input.paymentMode ?? 'variable_monthly',
    interest_rate_annual: interestRateAnnual ?? null,
    notes: input.notes?.trim() || null,
  };
}

export async function createDebt(input: DebtFormInput): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('กรุณาเข้าสู่ระบบใหม่');
  const row = buildDebtRow(input);
  const { error } = await supabase.from('debts').insert({ ...row, user_id: user.id, debt_type: 'other', status: 'active', amount_paid_this_cycle_satang: 0 });
  if (error) throw new Error('บันทึกหนี้ไม่สำเร็จ');
}

export async function updateDebt(id: string, input: DebtFormInput): Promise<void> {
  const row = buildDebtRow(input);
  const { error } = await supabase.from('debts').update(row).eq('id', id);
  if (error) throw new Error('บันทึกหนี้ไม่สำเร็จ');
}

/** Soft delete, matching tanglak's deleteDebt (status='deleted', deleted_at set). */
export async function deleteDebt(id: string): Promise<void> {
  const { error } = await supabase.from('debts').update({ status: 'deleted', deleted_at: new Date().toISOString() }).eq('id', id);
  if (error) throw new Error('ลบหนี้ไม่สำเร็จ');
}
