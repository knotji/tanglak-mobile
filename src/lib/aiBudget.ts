import { supabase } from '@/lib/supabaseClient';
import type { Transaction } from '@/lib/transactions';

export interface AiBudgetHistoryMonth {
  month: string;
  totalExpenseSatang: number;
  categories: Array<{ categoryId: string; label: string; spentSatang: number }>;
}

export interface AiBudgetPlanItem {
  categoryId: string;
  label: string;
  suggestedSatang: number;
  reason: string;
}

export interface AiBudgetPlan {
  summary: string;
  savingsSatang: number;
  items: AiBudgetPlanItem[];
}

export interface RequestAiBudgetPlanInput {
  monthlyIncomeSatang: number;
  history: AiBudgetHistoryMonth[];
  currentBudgets: Array<{ categoryId: string; label: string; amountSatang: number }>;
  availableCategories: Array<{ id: string; label: string }>;
}

export function summarizeBudgetHistory(
  months: Array<{ month: string; transactions: Transaction[] }>,
  categoryIdByLabel: Map<string, string>,
): AiBudgetHistoryMonth[] {
  return months.map(({ month, transactions }) => {
    const totals = new Map<string, { categoryId: string; label: string; spentSatang: number }>();
    let totalExpenseSatang = 0;

    for (const transaction of transactions) {
      const direction = transaction.type === 'expense' || transaction.type === 'debt_payment'
        ? 1
        : transaction.type === 'refund' ? -1 : 0;
      const label = transaction.categoryLabel?.trim();
      if (direction === 0 || !label) continue;
      const categoryId = categoryIdByLabel.get(label);
      if (!categoryId) continue;

      const current = totals.get(categoryId) ?? { categoryId, label, spentSatang: 0 };
      current.spentSatang += direction * transaction.amountSatang;
      totals.set(categoryId, current);
      totalExpenseSatang += direction * transaction.amountSatang;
    }

    return {
      month,
      totalExpenseSatang: Math.max(0, totalExpenseSatang),
      categories: [...totals.values()]
        .map((item) => ({ ...item, spentSatang: Math.max(0, item.spentSatang) }))
        .filter((item) => item.spentSatang > 0)
        .sort((a, b) => b.spentSatang - a.spentSatang),
    };
  });
}

export async function requestAiBudgetPlan(input: RequestAiBudgetPlanInput): Promise<AiBudgetPlan> {
  const { data, error } = await supabase.functions.invoke('suggest-budget', { body: input });
  if (error) throw new Error('AI ยังวิเคราะห์งบไม่ได้ กรุณาลองใหม่');
  if (data?.error) throw new Error(String(data.error));

  const plan = data?.data as AiBudgetPlan | undefined;
  if (!plan || !Array.isArray(plan.items)) throw new Error('AI ส่งแผนงบที่ไม่สมบูรณ์');
  return plan;
}
