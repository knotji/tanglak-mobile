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
  payment_mode: Debt['paymentMode'] | null;
  interest_rate_annual: number | null;
  notes: string | null;
  status: string;
}

const COLUMNS =
  'id, name, creditor, outstanding_balance_satang, amount_due_satang, minimum_payment_satang, amount_paid_this_cycle_satang, due_date, recurring_due_day, payment_mode, interest_rate_annual, notes, status';

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
    paymentMode: row.payment_mode ?? 'variable_monthly',
    interestRateAnnual: row.interest_rate_annual,
    notes: row.notes,
    status: row.status,
  };
}

/** Matches tanglak's listDebts default (includeClosed=false): excludes deleted and paid_off. */
export async function listDebts(): Promise<Debt[]> {
  const { data, error } = await supabase
    .from('debts')
    .select(COLUMNS)
    .neq('status', 'deleted')
    .neq('status', 'paid_off')
    .order('due_date', { ascending: true });
  if (error) throw new Error('โหลดรายการหนี้ไม่สำเร็จ');
  return (data ?? []).map(mapRow);
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
