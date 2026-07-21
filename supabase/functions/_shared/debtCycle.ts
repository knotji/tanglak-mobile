// Shared by add-debt-payment and delete-transaction: both need to recompute
// a debt's amount_paid_this_cycle_satang after a debt_payment transaction
// changes. Ported from tanglak/src/lib/finance/date.ts (getDebtCycleWindow)
// and finance-repository.ts (recalculateDebtPaidThisCycle).
export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function shiftDateKey(dateKey: string, offsetDays: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}

function bangkokDateStartInstant(dateKey: string): string {
  return `${dateKey}T00:00:00+07:00`;
}

function getBangkokTodayString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

export function getDebtCycleWindow(debt: { cycle_start_date: string | null; cycle_end_date: string | null }, today: Date) {
  if (debt.cycle_start_date && debt.cycle_end_date && isValidDateKey(debt.cycle_start_date) && isValidDateKey(debt.cycle_end_date)) {
    return {
      startInstant: bangkokDateStartInstant(debt.cycle_start_date),
      endExclusiveInstant: bangkokDateStartInstant(shiftDateKey(debt.cycle_end_date, 1)),
    };
  }
  const todayKey = getBangkokTodayString(today);
  const [year, month] = todayKey.split('-').map(Number);
  const startDate = `${todayKey.slice(0, 7)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${todayKey.slice(0, 7)}-${String(daysInMonth).padStart(2, '0')}`;
  return { startInstant: bangkokDateStartInstant(startDate), endExclusiveInstant: bangkokDateStartInstant(shiftDateKey(endDate, 1)) };
}

/**
 * Recomputes and writes debts.amount_paid_this_cycle_satang from scratch by
 * summing confirmed debt_payment transactions inside the debt's current
 * cycle window. Never increments in place, never touches
 * outstanding_balance_satang. Caller must have already verified the debt
 * belongs to the authenticated user.
 */
export async function recalculateDebtPaidThisCycle(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  debtId: string,
): Promise<{ error: string | null }> {
  const { data: debt, error: debtError } = await supabase
    .from('debts')
    .select('cycle_start_date, cycle_end_date')
    .eq('id', debtId)
    .eq('user_id', userId)
    .maybeSingle();
  if (debtError || !debt) return { error: debtError?.message ?? 'debt not found' };

  const cycle = getDebtCycleWindow(debt, new Date());
  const { data: cycleRows, error: sumError } = await supabase
    .from('transactions')
    .select('amount_satang')
    .eq('user_id', userId)
    .eq('debt_id', debtId)
    .eq('type', 'debt_payment')
    .eq('status', 'confirmed')
    .gte('occurred_at', cycle.startInstant)
    .lt('occurred_at', cycle.endExclusiveInstant);
  if (sumError) return { error: sumError.message };

  const total = (cycleRows ?? []).reduce((sum: number, row: { amount_satang: number }) => sum + Number(row.amount_satang), 0);
  const { error: updateError } = await supabase
    .from('debts')
    .update({ amount_paid_this_cycle_satang: total })
    .eq('id', debtId)
    .eq('user_id', userId)
    .neq('status', 'deleted');
  return { error: updateError?.message ?? null };
}
