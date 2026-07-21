import type { Transaction } from '@/lib/transactions';
import { isoInstantToBangkokDatetimeLocal } from '@/lib/date';

export interface TransactionDayGroup {
  dateKey: string;
  transactions: Transaction[];
}

/** Groups already date-sorted (desc) transactions into per-Bangkok-day buckets, preserving order. */
export function groupTransactionsByBangkokDay(transactions: Transaction[]): TransactionDayGroup[] {
  const groups: TransactionDayGroup[] = [];
  const byKey = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const dateKey = isoInstantToBangkokDatetimeLocal(transaction.occurredAt).slice(0, 10);
    let bucket = byKey.get(dateKey);
    if (!bucket) {
      bucket = [];
      byKey.set(dateKey, bucket);
      groups.push({ dateKey, transactions: bucket });
    }
    bucket.push(transaction);
  }
  return groups;
}

/** Ported from tanglak's TransactionGroup.tsx: income/refund add, transfer is excluded, everything else subtracts. */
export function dayNetSatang(transactions: Transaction[]): number {
  return transactions.reduce((sum, t) => {
    if (t.type === 'income' || t.type === 'refund') return sum + t.amountSatang;
    if (t.type === 'transfer') return sum;
    return sum - t.amountSatang;
  }, 0);
}
