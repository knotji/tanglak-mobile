import { describe, expect, it, vi } from 'vitest';
import { requestAiBudgetPlan, summarizeBudgetHistory } from '@/lib/aiBudget';
import type { Transaction } from '@/lib/transactions';

function transaction(type: Transaction['type'], amountSatang: number, categoryLabel: string | null): Transaction {
  return {
    id: `${type}-${amountSatang}`,
    type,
    amountSatang,
    occurredAt: '2026-07-01T00:00:00Z',
    merchant: null,
    categoryLabel,
    paymentMethod: null,
    note: null,
  };
}

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: { functions: { invoke } },
}));

describe('summarizeBudgetHistory', () => {
  it('shares only categorized monthly aggregates and subtracts refunds', () => {
    const result = summarizeBudgetHistory([
      {
        month: '2026-06',
        transactions: [
          transaction('expense', 10_000, 'อาหาร'),
          transaction('debt_payment', 5_000, 'บัตร'),
          transaction('refund', 2_000, 'อาหาร'),
          transaction('income', 50_000, 'เงินเดือน'),
          { ...transaction('expense', 9_000, null), merchant: 'private merchant' },
        ],
      },
    ], new Map([['อาหาร', 'food'], ['บัตร', 'debt']]));

    expect(result).toEqual([{
      month: '2026-06',
      totalExpenseSatang: 13_000,
      categories: [
        { categoryId: 'food', label: 'อาหาร', spentSatang: 8_000 },
        { categoryId: 'debt', label: 'บัตร', spentSatang: 5_000 },
      ],
    }]);
    expect(JSON.stringify(result)).not.toContain('private merchant');
  });
});

describe('requestAiBudgetPlan', () => {
  const input = {
    monthlyIncomeSatang: 3_000_000,
    history: [],
    currentBudgets: [],
    availableCategories: [{ id: 'food', label: 'อาหาร' }],
  };

  it('calls the authenticated Edge Function with aggregate input', async () => {
    const plan = {
      summary: 'แผนทดสอบ',
      savingsSatang: 600_000,
      items: [{ categoryId: 'food', label: 'อาหาร', suggestedSatang: 500_000, reason: 'จากค่าเฉลี่ย' }],
    };
    invoke.mockResolvedValueOnce({ data: { data: plan }, error: null });

    await expect(requestAiBudgetPlan(input)).resolves.toEqual(plan);
    expect(invoke).toHaveBeenCalledWith('suggest-budget', { body: input });
  });

  it('rejects transport and incomplete responses', async () => {
    invoke
      .mockResolvedValueOnce({ data: null, error: new Error('offline') })
      .mockResolvedValueOnce({ data: { data: { summary: 'missing items' } }, error: null });

    await expect(requestAiBudgetPlan(input)).rejects.toThrow('AI ยังวิเคราะห์งบไม่ได้');
    await expect(requestAiBudgetPlan(input)).rejects.toThrow('AI ส่งแผนงบที่ไม่สมบูรณ์');
  });
});
