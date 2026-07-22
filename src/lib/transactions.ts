import { supabase } from '@/lib/supabaseClient';
import { todayBangkokRange, bangkokMonthRange } from '@/lib/bangkokDate';

export type TransactionType = 'income' | 'expense' | 'debt_payment' | 'transfer' | 'refund';

export interface Transaction {
  id: string;
  type: TransactionType;
  amountSatang: number;
  occurredAt: string;
  merchant: string | null;
  categoryLabel: string | null;
  paymentMethod: string | null;
}

// Matches tanglak's TRANSACTION_COLUMNS selection, trimmed to what the
// mobile list/today views render.
const COLUMNS = 'id, type, amount_satang, occurred_at, merchant, category_label, payment_method';

interface TransactionRow {
  id: string;
  type: TransactionType;
  amount_satang: number;
  occurred_at: string;
  merchant: string | null;
  category_label: string | null;
  payment_method: string | null;
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type,
    amountSatang: row.amount_satang,
    occurredAt: row.occurred_at,
    merchant: row.merchant,
    categoryLabel: row.category_label,
    paymentMethod: row.payment_method,
  };
}

/** All transactions within a Bangkok calendar month (`YYYY-MM`), newest first. */
export async function listTransactionsForMonth(month: string): Promise<Transaction[]> {
  const { start, end } = bangkokMonthRange(month);
  const { data, error } = await supabase
    .from('transactions')
    .select(COLUMNS)
    .gte('occurred_at', start)
    .lt('occurred_at', end)
    .order('occurred_at', { ascending: false });
  if (error) throw new Error('โหลดรายการไม่สำเร็จ');
  return (data ?? []).map(mapRow);
}

export async function listTodayTransactions(): Promise<Transaction[]> {
  const { start, end } = todayBangkokRange();
  const { data, error } = await supabase
    .from('transactions')
    .select(COLUMNS)
    .gte('occurred_at', start)
    .lt('occurred_at', end)
    .order('occurred_at', { ascending: false });
  if (error) throw new Error('โหลดข้อมูลวันนี้ไม่สำเร็จ');
  return (data ?? []).map(mapRow);
}

export async function getTransactionById(id: string): Promise<Transaction | null> {
  const { data, error } = await supabase.from('transactions').select(COLUMNS).eq('id', id).maybeSingle();
  if (error) throw new Error('โหลดรายการไม่สำเร็จ');
  return data ? mapRow(data) : null;
}
