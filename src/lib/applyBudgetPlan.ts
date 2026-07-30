import type { BudgetCategoryRow } from '@/lib/budget';

interface BudgetPlanItem {
  label: string;
  suggestedSatang: number;
}

interface BudgetPlanOperations {
  update: (categoryId: string, amountBaht: string) => Promise<void>;
  add: (budgetId: string, label: string, amountBaht: string) => Promise<BudgetCategoryRow>;
  remove: (categoryId: string) => Promise<void>;
}

type RollbackStep = () => Promise<void>;

export async function applyBudgetPlan({
  budgetId,
  categories,
  items,
  selectedLabels,
  operations,
}: {
  budgetId: string;
  categories: BudgetCategoryRow[];
  items: BudgetPlanItem[];
  selectedLabels: ReadonlySet<string>;
  operations: BudgetPlanOperations;
}): Promise<BudgetCategoryRow[]> {
  const nextCategories = categories.map((category) => ({ ...category }));
  const rollbackSteps: RollbackStep[] = [];

  try {
    for (const item of items) {
      if (!selectedLabels.has(item.label)) continue;

      const existingIndex = nextCategories.findIndex((category) => category.label === item.label);
      const amountBaht = String(item.suggestedSatang / 100);
      if (existingIndex >= 0) {
        const existing = nextCategories[existingIndex];
        const previousAmountBaht = String(existing.amountSatang / 100);
        await operations.update(existing.id, amountBaht);
        rollbackSteps.push(() => operations.update(existing.id, previousAmountBaht));
        nextCategories[existingIndex] = { ...existing, amountSatang: item.suggestedSatang };
      } else {
        const row = await operations.add(budgetId, item.label, amountBaht);
        rollbackSteps.push(() => operations.remove(row.id));
        nextCategories.push(row);
      }
    }

    return nextCategories;
  } catch (cause) {
    const rollbackResults = await Promise.allSettled(
      rollbackSteps.reverse().map((rollback) => rollback()),
    );
    if (rollbackResults.some((result) => result.status === 'rejected')) {
      throw new Error('ใช้แผนงบไม่สำเร็จ และคืนค่าบางส่วนไม่ได้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบ');
    }
    throw cause;
  }
}
