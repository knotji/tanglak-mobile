// Shared by add-debt-payment and delete-transaction: both need to recompute
// a debt's amount_paid_this_cycle_satang after a debt_payment transaction
// changes.

/**
 * Recomputes debts.amount_paid_this_cycle_satang from scratch by summing
 * confirmed debt_payment transactions inside the debt's current cycle
 * window. Never increments in place, never touches
 * outstanding_balance_satang.
 *
 * Delegates to the `public.recalculate_debt_paid_this_cycle(uuid)` Postgres
 * function (see tanglak/supabase/migrations/202607110009_harden_debt_
 * recalculation_execute.sql) instead of doing a client-side
 * select-sum-then-update. Two concurrent calls for the same debt (a
 * double-tapped save, or the same account open on two devices) used to
 * race: each does its own SELECT+SUM, then both UPDATE -- whichever UPDATE
 * lands last wins even if its SELECT read stale data, silently under- or
 * over-counting the total. The RPC's `update ... set x = (select sum(...))`
 * is a single atomic statement, so Postgres serializes concurrent calls on
 * the same row via its own row lock instead of racing in application code.
 * The function is also ownership-checked (rejects a debt_id that isn't the
 * caller's own), which is a no-op here since the caller already verified
 * ownership, but is free extra defense-in-depth.
 */
export async function recalculateDebtPaidThisCycle(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  _userId: string,
  debtId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('recalculate_debt_paid_this_cycle', { target_debt_id: debtId });
  return { error: error?.message ?? null };
}
