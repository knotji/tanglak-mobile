import { describe, expect, it } from 'vitest';
import { dayNetSatang, groupTransactionsByBangkokDay } from './groupByDay';
import type { Transaction } from './transactions';

function makeTransaction(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amountSatang' | 'occurredAt'>): Transaction {
  return { merchant: null, categoryLabel: null, paymentMethod: null, ...overrides };
}

describe('groupTransactionsByBangkokDay', () => {
  it('buckets transactions by their Bangkok calendar day', () => {
    const transactions = [
      makeTransaction({ id: 'a', type: 'expense', amountSatang: 100, occurredAt: '2026-07-11T05:00:00Z' }), // 12:00 Bangkok, 11th
      makeTransaction({ id: 'b', type: 'expense', amountSatang: 200, occurredAt: '2026-07-10T20:00:00Z' }), // 03:00 Bangkok, 11th
      makeTransaction({ id: 'c', type: 'expense', amountSatang: 300, occurredAt: '2026-07-10T05:00:00Z' }), // 12:00 Bangkok, 10th
    ];
    const groups = groupTransactionsByBangkokDay(transactions);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-07-11', '2026-07-10']);
    expect(groups[0].transactions.map((t) => t.id)).toEqual(['a', 'b']);
    expect(groups[1].transactions.map((t) => t.id)).toEqual(['c']);
  });

  it('preserves the original order of transactions within a day', () => {
    const transactions = [
      makeTransaction({ id: 'first', type: 'expense', amountSatang: 100, occurredAt: '2026-07-11T10:00:00Z' }),
      makeTransaction({ id: 'second', type: 'expense', amountSatang: 200, occurredAt: '2026-07-11T05:00:00Z' }),
    ];
    const groups = groupTransactionsByBangkokDay(transactions);
    expect(groups[0].transactions.map((t) => t.id)).toEqual(['first', 'second']);
  });

  it('returns an empty array for no transactions', () => {
    expect(groupTransactionsByBangkokDay([])).toEqual([]);
  });
});

describe('dayNetSatang', () => {
  it('adds income and refunds, subtracts everything else except transfers', () => {
    const transactions = [
      makeTransaction({ id: 'a', type: 'income', amountSatang: 1000, occurredAt: '2026-07-11T05:00:00Z' }),
      makeTransaction({ id: 'b', type: 'refund', amountSatang: 200, occurredAt: '2026-07-11T05:00:00Z' }),
      makeTransaction({ id: 'c', type: 'expense', amountSatang: 300, occurredAt: '2026-07-11T05:00:00Z' }),
      makeTransaction({ id: 'd', type: 'debt_payment', amountSatang: 400, occurredAt: '2026-07-11T05:00:00Z' }),
    ];
    // 1000 + 200 - 300 - 400 = 500
    expect(dayNetSatang(transactions)).toBe(500);
  });

  it('excludes transfers entirely from the net', () => {
    const transactions = [
      makeTransaction({ id: 'a', type: 'income', amountSatang: 1000, occurredAt: '2026-07-11T05:00:00Z' }),
      makeTransaction({ id: 'b', type: 'transfer', amountSatang: 5000, occurredAt: '2026-07-11T05:00:00Z' }),
    ];
    expect(dayNetSatang(transactions)).toBe(1000);
  });

  it('is 0 for an empty list', () => {
    expect(dayNetSatang([])).toBe(0);
  });
});
