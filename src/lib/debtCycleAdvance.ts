// Advance to next cycle. Explicit user action only -- never automatic
// except the one narrow case in debts.ts's listDebts() (a debt that's
// already fully paid AND past due). tanglak's own debt-status.ts is
// explicit that "cycle_paid_in_full ... must never be" auto-transitioned
// into anything else; the same "no silent financial-state transition"
// philosophy applies here. Neither the web app nor mobile has ever had a
// general auto-rollover feature -- this is deliberately scoped to just
// moving the static due_date/cycle_start_date/cycle_end_date fields
// forward by one month and recomputing amount_paid_this_cycle_satang for
// the new window. It never touches outstanding_balance_satang (a human
// must still update that from their actual statement -- advancing the
// cycle is not the same claim as "the balance changed").
//
// Kept separate from debts.ts (CRUD/reads) and debtStatus.ts (pure status
// calculations) since this is the one place in the client that performs a
// derived-aggregate write, matching the Edge Function equivalent at
// supabase/functions/_shared/debtCycle.ts (this client-side copy needs no
// elevated privilege since RLS + the debt's own ownership already scope it).
import { supabase } from '@/lib/supabaseClient';
import type { Debt } from '@/lib/debts';

export function daysInMonth(year: number, month1based: number): number {
  return new Date(Date.UTC(year, month1based, 0)).getUTCDate();
}

/** Shifts a YYYY-MM-DD date forward by exactly one month, clamping the day if the target month is shorter. */
export function shiftDateKeyByOneMonth(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const targetYear = m === 12 ? y + 1 : y;
  const targetMonth = m === 12 ? 1 : m + 1;
  const day = Math.min(d, daysInMonth(targetYear, targetMonth));
  return `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Same as shiftDateKeyByOneMonth, but uses recurringDueDay for the target day when set (matches "due on the Nth of every month" semantics) instead of preserving the original day-of-month. */
export function nextDueDate(currentDueDate: string, recurringDueDay: number | null): string {
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

function getBangkokTodayString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

export function addOneDay(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}-${String(next.getUTCDate()).padStart(2, '0')}`;
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
