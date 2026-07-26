import { supabase } from '@/lib/supabaseClient';
import { bangkokMonthRange, currentBangkokMonth } from '@/lib/bangkokDate';
import { listDebts, remainingToMinimum } from '@/lib/debts';
import type { Transaction } from '@/lib/transactions';

// Ported from tanglak/src/lib/finance/calculations.ts (calculateMonthlyTotals,
// calculateCashRemaining) and src/app/overview/page.tsx's data assembly.
export interface MonthlyTotals {
  incomeSatang: number;
  livingExpenseSatang: number;
  debtPaymentSatang: number;
  refundSatang: number;
}

export interface OverviewSnapshot {
  totals: MonthlyTotals;
  /** Saved planned income for the month (same source as Budget), not the sum of income transactions -- see calculateCashRemaining in the web app. */
  plannedIncomeSatang: number;
  cashRemainingSatang: number;
  totalOutstandingSatang: number;
  totalMinimumDueSatang: number;
  debtCount: number;
}

async function getPlannedIncomeSatang(month: string): Promise<number> {
  const { data, error } = await supabase.from('monthly_budgets').select('income_satang').eq('month', month).maybeSingle();
  if (error) throw new Error('โหลดข้อมูลรายรับไม่สำเร็จ');
  return data ? Number(data.income_satang) : 0;
}

function summarizeMonthlyTotals(transactions: Pick<Transaction, 'type' | 'amountSatang'>[]): MonthlyTotals {
  const totals: MonthlyTotals = { incomeSatang: 0, livingExpenseSatang: 0, debtPaymentSatang: 0, refundSatang: 0 };
  for (const tx of transactions) {
    if (tx.type === 'income') totals.incomeSatang += tx.amountSatang;
    else if (tx.type === 'expense') totals.livingExpenseSatang += tx.amountSatang;
    else if (tx.type === 'debt_payment') totals.debtPaymentSatang += tx.amountSatang;
    else if (tx.type === 'refund') totals.refundSatang += tx.amountSatang;
  }
  return totals;
}

async function getMonthlyTotals(month: string): Promise<MonthlyTotals> {
  const { start, end } = bangkokMonthRange(month);
  const { data, error } = await supabase
    .from('transactions')
    .select('type, amount_satang')
    .eq('status', 'confirmed')
    .gte('occurred_at', start)
    .lt('occurred_at', end);
  if (error) throw new Error('โหลดรายการเดือนนี้ไม่สำเร็จ');
  return summarizeMonthlyTotals((data ?? []).map((row) => ({ type: row.type as Transaction['type'], amountSatang: Number(row.amount_satang) })));
}

/**
 * `monthTransactions`, if given, skips this function's own transactions
 * query and reuses the caller's already-fetched rows to compute totals
 * instead -- OverviewPage needs the full month's transactions anyway (for
 * its category breakdown), so without this it was firing two separate
 * "select this month's transactions" queries against the same table/range
 * on every single page visit.
 */
export async function getOverviewSnapshot(monthTransactions?: Pick<Transaction, 'type' | 'amountSatang'>[]): Promise<OverviewSnapshot> {
  const month = currentBangkokMonth();
  const [totals, plannedIncomeSatang, debts] = await Promise.all([
    monthTransactions ? Promise.resolve(summarizeMonthlyTotals(monthTransactions)) : getMonthlyTotals(month),
    getPlannedIncomeSatang(month),
    listDebts(),
  ]);

  const cashRemainingSatang = plannedIncomeSatang + totals.refundSatang - totals.livingExpenseSatang - totals.debtPaymentSatang;
  const totalOutstandingSatang = debts.reduce((sum, debt) => sum + (debt.outstandingBalanceSatang ?? 0), 0);
  const totalMinimumDueSatang = debts.reduce((sum, debt) => sum + remainingToMinimum(debt), 0);

  return {
    totals,
    plannedIncomeSatang,
    cashRemainingSatang,
    totalOutstandingSatang,
    totalMinimumDueSatang,
    debtCount: debts.length,
  };
}
