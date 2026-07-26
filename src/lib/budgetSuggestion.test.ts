import { describe, expect, it } from 'vitest';
import { suggestBudgetFromHistory, suggestBudgetFromIncomeRatio } from './budgetSuggestion';
import type { Transaction } from './transactions';

function makeTransaction(overrides: Partial<Transaction> & Pick<Transaction, 'id' | 'type' | 'amountSatang'>): Transaction {
  return { occurredAt: '2026-07-11T05:00:00Z', merchant: null, categoryLabel: null, paymentMethod: null, note: null, ...overrides };
}

describe('suggestBudgetFromHistory', () => {
  it('flags insufficient data when there are too few transactions overall', () => {
    const months = [
      [makeTransaction({ id: 'a', type: 'expense', amountSatang: 10000, categoryLabel: 'อาหาร' })],
      [],
      [],
    ];
    const result = suggestBudgetFromHistory(months);
    expect(result.insufficientData).toBe(true);
  });

  it('averages spend per category across the analyzed months', () => {
    const months = [
      [makeTransaction({ id: 'a1', type: 'expense', amountSatang: 100_00, categoryLabel: 'อาหาร' })],
      [makeTransaction({ id: 'a2', type: 'expense', amountSatang: 200_00, categoryLabel: 'อาหาร' })],
      [makeTransaction({ id: 'a3', type: 'expense', amountSatang: 300_00, categoryLabel: 'อาหาร' })],
      [makeTransaction({ id: 'a4', type: 'expense', amountSatang: 100_00, categoryLabel: 'อาหาร' })],
      [makeTransaction({ id: 'a5', type: 'expense', amountSatang: 100_00, categoryLabel: 'อาหาร' })],
    ];
    const result = suggestBudgetFromHistory(months);
    const food = result.categories.find((c) => c.label === 'อาหาร');
    // average = (100+200+300+100+100)/5 = 160
    expect(food?.averageSatang).toBe(160_00);
    expect(food?.monthsWithSpend).toBe(5);
  });

  it('pads the suggested amount above the raw average and rounds to the nearest 50 baht', () => {
    const months = Array.from({ length: 5 }, (_, i) => [
      makeTransaction({ id: `t${i}`, type: 'expense', amountSatang: 100_00, categoryLabel: 'อาหาร' }),
    ]);
    const result = suggestBudgetFromHistory(months);
    const food = result.categories.find((c) => c.label === 'อาหาร');
    // 100 * 1.15 = 115, rounded up to nearest 50 -> 150
    expect(food?.suggestedSatang).toBe(150_00);
  });

  it('subtracts refunds and only counts expense/debt_payment/refund toward spend', () => {
    const months = [
      [
        makeTransaction({ id: 'e1', type: 'expense', amountSatang: 100_00, categoryLabel: 'ช้อปปิ้ง' }),
        makeTransaction({ id: 'r1', type: 'refund', amountSatang: 30_00, categoryLabel: 'ช้อปปิ้ง' }),
        makeTransaction({ id: 'i1', type: 'income', amountSatang: 5000_00, categoryLabel: 'ช้อปปิ้ง' }),
      ],
      [makeTransaction({ id: 'e2', type: 'expense', amountSatang: 100_00, categoryLabel: 'ช้อปปิ้ง' })],
      [makeTransaction({ id: 'e3', type: 'expense', amountSatang: 100_00, categoryLabel: 'ช้อปปิ้ง' })],
      [makeTransaction({ id: 'e4', type: 'expense', amountSatang: 100_00, categoryLabel: 'ช้อปปิ้ง' })],
      [makeTransaction({ id: 'e5', type: 'expense', amountSatang: 100_00, categoryLabel: 'ช้อปปิ้ง' })],
    ];
    const result = suggestBudgetFromHistory(months);
    const shopping = result.categories.find((c) => c.label === 'ช้อปปิ้ง');
    // total = (100-30) + 100*4 = 470, average = 470/5 = 94
    expect(shopping?.averageSatang).toBe(94_00);
  });

  it('omits transactions with no category label', () => {
    const months = [
      [makeTransaction({ id: 'a', type: 'expense', amountSatang: 100_00, categoryLabel: null })],
      [makeTransaction({ id: 'b', type: 'expense', amountSatang: 100_00, categoryLabel: '' })],
      [], [], [],
    ];
    const result = suggestBudgetFromHistory(months);
    expect(result.categories).toEqual([]);
  });

  it('sorts categories by highest average spend first', () => {
    const months = Array.from({ length: 5 }, (_, i) => [
      makeTransaction({ id: `low${i}`, type: 'expense', amountSatang: 50_00, categoryLabel: 'เล็ก' }),
      makeTransaction({ id: `high${i}`, type: 'expense', amountSatang: 500_00, categoryLabel: 'ใหญ่' }),
    ]);
    const result = suggestBudgetFromHistory(months);
    expect(result.categories.map((c) => c.label)).toEqual(['ใหญ่', 'เล็ก']);
  });

  it('reports insufficientData as false once there is enough real history', () => {
    const months = Array.from({ length: 3 }, (_, i) => [
      makeTransaction({ id: `a${i}`, type: 'expense', amountSatang: 100_00, categoryLabel: 'อาหาร' }),
      makeTransaction({ id: `b${i}`, type: 'expense', amountSatang: 50_00, categoryLabel: 'เดินทาง' }),
    ]);
    const result = suggestBudgetFromHistory(months);
    expect(result.insufficientData).toBe(false);
    expect(result.totalTransactionsAnalyzed).toBe(6);
  });
});

describe('suggestBudgetFromIncomeRatio', () => {
  const labelFor = (id: string) => `label:${id}`;

  it('flags insufficient data when income is zero or negative', () => {
    expect(suggestBudgetFromIncomeRatio(0, 0, labelFor).insufficientData).toBe(true);
    expect(suggestBudgetFromIncomeRatio(-100_00, 0, labelFor).insufficientData).toBe(true);
  });

  it('splits income into needs/wants pools without a real debt figure', () => {
    const result = suggestBudgetFromIncomeRatio(30000_00, 0, labelFor);
    expect(result.insufficientData).toBe(false);
    expect(result.debtSuggestion).toBeNull();
    expect(result.needs.length).toBeGreaterThan(0);
    expect(result.wants.length).toBeGreaterThan(0);

    // needs pool is 50% of income; each category's suggestion should not
    // individually exceed that pool.
    const needsPoolSatang = 30000_00 * 0.5;
    for (const item of result.needs) {
      expect(item.suggestedSatang).toBeLessThanOrEqual(needsPoolSatang);
    }
  });

  it('sizes the debt category from the real minimum-due total, not a generic ratio', () => {
    const result = suggestBudgetFromIncomeRatio(30000_00, 4321_00, labelFor);
    expect(result.debtSuggestion).not.toBeNull();
    // Rounded up to the nearest 50 baht.
    expect(result.debtSuggestion?.suggestedSatang).toBe(4350_00);
    expect(result.debtSuggestion?.categoryId).toBe('debt');
  });

  it('uses the provided label lookup for every suggested category', () => {
    const result = suggestBudgetFromIncomeRatio(30000_00, 1000_00, labelFor);
    for (const item of [...result.needs, ...result.wants]) {
      expect(item.label).toBe(labelFor(item.categoryId));
    }
    expect(result.debtSuggestion?.label).toBe(labelFor('debt'));
  });

  it('sorts each pool by suggested amount, highest first', () => {
    const result = suggestBudgetFromIncomeRatio(30000_00, 0, labelFor);
    const isSorted = (items: { suggestedSatang: number }[]) => items.every((item, i) => i === 0 || items[i - 1].suggestedSatang >= item.suggestedSatang);
    expect(isSorted(result.needs)).toBe(true);
    expect(isSorted(result.wants)).toBe(true);
  });
});
