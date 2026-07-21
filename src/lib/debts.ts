import { supabase } from '@/lib/supabaseClient';
import { bahtToSatang } from '@/lib/money';

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
function shouldAutoAdvance(debt: Debt): boolean {
  if (!debt.dueDate) return false;
  if (debt.amountDueSatang === null || debt.amountDueSatang <= 0) return false;
  if (debt.amountPaidThisCycleSatang < debt.amountDueSatang) return false;
  return daysUntilDue(debt.dueDate) < 0;
}

/** Matches tanglak's listDebts default (includeClosed=false): excludes deleted and paid_off. Auto-advances any debt whose cycle is fully paid and past due before returning (see shouldAutoAdvance). */
export async function listDebts(): Promise<Debt[]> {
  const debts = await fetchDebtRows();
  const toAdvance = debts.filter(shouldAutoAdvance);
  if (toAdvance.length === 0) return debts;

  for (const debt of toAdvance) {
    try {
      await advanceDebtCycle(debt);
    } catch {
      // Best-effort: a failed auto-advance (e.g. a transient network blip)
      // should never block the user from seeing their debt list. It will
      // simply be retried on the next load.
    }
  }
  return fetchDebtRows();
}

export async function getDebtById(id: string): Promise<Debt | null> {
  const { data, error } = await supabase.from('debts').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error('โหลดข้อมูลหนี้ไม่สำเร็จ');
  return data ? mapRow(data) : null;
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

// --- Pure calculations, ported from tanglak/src/lib/finance/{calculations,debt-status,debt-interest}.ts ---

export function remainingToMinimum(debt: Debt): number {
  return Math.max(0, (debt.minimumPaymentSatang ?? 0) - debt.amountPaidThisCycleSatang);
}

export function paymentProgress(debt: Debt): number {
  const target = debt.minimumPaymentSatang ?? debt.amountDueSatang ?? 0;
  if (target <= 0) return 1;
  return Math.min(1, debt.amountPaidThisCycleSatang / target);
}

function getBangkokTodayString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

export function daysUntilDue(dueDate: string, today = new Date()): number {
  const [todayYear, todayMonth, todayDay] = getBangkokTodayString(today).split('-').map(Number);
  const start = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = Date.UTC(year, month - 1, day);
  return Math.ceil((due - start) / 86_400_000);
}

export type DebtDueStatus = 'not_yet_due' | 'due_soon' | 'due_today' | 'overdue' | 'minimum_paid' | 'cycle_paid_in_full';

export const DEBT_DUE_STATUS_LABEL_TH: Record<DebtDueStatus, string> = {
  not_yet_due: 'ยังไม่ถึงกำหนด',
  due_soon: 'ใกล้ครบกำหนด',
  due_today: 'ครบกำหนดวันนี้',
  overdue: 'เกินกำหนด',
  minimum_paid: 'จ่ายขั้นต่ำแล้ว',
  cycle_paid_in_full: 'จ่ายครบยอดรอบนี้แล้ว',
};

const DEBT_DUE_SOON_WINDOW_DAYS = 3;

export function debtDueStatus(debt: Debt, today: Date = new Date()): DebtDueStatus {
  const paid = debt.amountPaidThisCycleSatang;
  if (debt.amountDueSatang !== null && debt.amountDueSatang !== undefined && debt.amountDueSatang > 0 && paid >= debt.amountDueSatang) {
    return 'cycle_paid_in_full';
  }
  if (debt.minimumPaymentSatang !== null && debt.minimumPaymentSatang !== undefined && debt.minimumPaymentSatang > 0 && paid >= debt.minimumPaymentSatang) {
    return 'minimum_paid';
  }
  if (!debt.dueDate) return 'not_yet_due';
  const days = daysUntilDue(debt.dueDate, today);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due_today';
  if (days <= DEBT_DUE_SOON_WINDOW_DAYS) return 'due_soon';
  return 'not_yet_due';
}

function formatRateNumber(rate: number): string {
  return Number(rate.toFixed(2)).toString();
}

/** "ดอกเบี้ย 16.5% ต่อปี (ประมาณ 1.38% ต่อเดือน)" */
export function formatInterestRateSummary(annualRatePercent: number): string {
  const monthly = annualRatePercent / 12;
  return `ดอกเบี้ย ${formatRateNumber(annualRatePercent)}% ต่อปี (ประมาณ ${formatRateNumber(monthly)}% ต่อเดือน)`;
}

// --- Advance to next cycle. Explicit user action only -- never automatic.
// tanglak's own debt-status.ts is explicit that "cycle_paid_in_full ...
// must never be" auto-transitioned into anything else; the same "no
// silent financial-state transition" philosophy applies here. Neither the
// web app nor mobile has ever had an auto-rollover feature -- this is a
// new, mobile-first feature, deliberately scoped to just moving the
// static due_date/cycle_start_date/cycle_end_date fields forward by one
// month and recomputing amount_paid_this_cycle_satang for the new
// window. It never touches outstanding_balance_satang (a human must
// still update that from their actual statement -- advancing the cycle
// is not the same claim as "the balance changed"). ---

function daysInMonth(year: number, month1based: number): number {
  return new Date(Date.UTC(year, month1based, 0)).getUTCDate();
}

/** Shifts a YYYY-MM-DD date forward by exactly one month, clamping the day if the target month is shorter. */
function shiftDateKeyByOneMonth(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const targetYear = m === 12 ? y + 1 : y;
  const targetMonth = m === 12 ? 1 : m + 1;
  const day = Math.min(d, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Same as shiftDateKeyByOneMonth, but uses recurringDueDay for the target day when set (matches "due on the Nth of every month" semantics) instead of preserving the original day-of-month. */
function nextDueDate(currentDueDate: string, recurringDueDay: number | null): string {
  if (!recurringDueDay) return shiftDateKeyByOneMonth(currentDueDate);
  const [y, m] = currentDueDate.split('-').map(Number);
  const targetYear = m === 12 ? y + 1 : y;
  const targetMonth = m === 12 ? 1 : m + 1;
  const day = Math.min(recurringDueDay, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function bangkokDateStartInstant(dateKey: string): string {
  return `${dateKey}T00:00:00+07:00`;
}

/** Recomputes amount_paid_this_cycle_satang from scratch for whatever cycle window the debt currently has (explicit cycle dates, or the current Bangkok calendar month as fallback) -- same logic as supabase/functions/_shared/debtCycle.ts, ported for direct client use since this write needs no elevated privilege (RLS + the debt's own ownership already scope it). */
async function recalculateAmountPaidThisCycle(debtId: string): Promise<void> {
  const { data: debt, error: debtError } = await supabase
    .from('debts')
    .select('cycle_start_date, cycle_end_date')
    .eq('id', debtId)
    .maybeSingle();
  if (debtError || !debt) throw new Error('ไม่พบหนี้นี้');

  let startInstant: string;
  let endExclusiveInstant: string;
  if (debt.cycle_start_date && debt.cycle_end_date) {
    // Cycle end is exclusive: the window runs through the end of
    // cycle_end_date, so the exclusive boundary is the day after it.
    startInstant = bangkokDateStartInstant(debt.cycle_start_date);
    endExclusiveInstant = bangkokDateStartInstant(addOneDay(debt.cycle_end_date));
  } else {
    const todayKey = getBangkokTodayString();
    const [y, m] = todayKey.split('-').map(Number);
    const start = `${todayKey.slice(0, 7)}-01`;
    const end = `${y}-${String(m).padStart(2, '0')}-${String(daysInMonth(y, m)).padStart(2, '0')}`;
    startInstant = bangkokDateStartInstant(start);
    endExclusiveInstant = bangkokDateStartInstant(addOneDay(end));
  }

  const { data: rows, error: sumError } = await supabase
    .from('transactions')
    .select('amount_satang')
    .eq('debt_id', debtId)
    .eq('type', 'debt_payment')
    .eq('status', 'confirmed')
    .gte('occurred_at', startInstant)
    .lt('occurred_at', endExclusiveInstant);
  if (sumError) throw new Error('คำนวณยอดจ่ายรอบนี้ไม่สำเร็จ');

  const total = (rows ?? []).reduce((sum, row) => sum + Number(row.amount_satang), 0);
  const { error: updateError } = await supabase.from('debts').update({ amount_paid_this_cycle_satang: total }).eq('id', debtId);
  if (updateError) throw new Error('บันทึกยอดจ่ายรอบนี้ไม่สำเร็จ');
}

function addOneDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
}

export interface CycleAdvancePreview {
  previousDueDate: string | null;
  nextDueDate: string;
}

export function previewCycleAdvance(debt: Debt): CycleAdvancePreview | null {
  if (!debt.dueDate) return null;
  return { previousDueDate: debt.dueDate, nextDueDate: nextDueDate(debt.dueDate, debt.recurringDueDay) };
}

/** Advances due_date (and cycle_start_date/cycle_end_date, if the debt has explicit ones) by one month, then recomputes amount_paid_this_cycle_satang for the new window. Never touches outstanding_balance_satang. */
export async function advanceDebtCycle(debt: Debt): Promise<void> {
  if (!debt.dueDate) throw new Error('หนี้นี้ยังไม่มีวันครบกำหนด');
  const patch: Record<string, string> = { due_date: nextDueDate(debt.dueDate, debt.recurringDueDay) };
  if (debt.cycleStartDate && debt.cycleEndDate) {
    patch.cycle_start_date = shiftDateKeyByOneMonth(debt.cycleStartDate);
    patch.cycle_end_date = shiftDateKeyByOneMonth(debt.cycleEndDate);
  }
  const { error } = await supabase.from('debts').update(patch).eq('id', debt.id);
  if (error) throw new Error('เริ่มรอบใหม่ไม่สำเร็จ');
  await recalculateAmountPaidThisCycle(debt.id);
}
