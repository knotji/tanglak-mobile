import { describe, expect, it, vi } from 'vitest';
import { applyBudgetPlan } from '@/lib/applyBudgetPlan';

describe('applyBudgetPlan', () => {
  it('returns the complete next state only after all selected writes succeed', async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const add = vi.fn().mockResolvedValue({ id: 'new-food', label: 'อาหาร', amountSatang: 500_00 });
    const remove = vi.fn().mockResolvedValue(undefined);

    const result = await applyBudgetPlan({
      budgetId: 'budget-1',
      categories: [{ id: 'travel', label: 'เดินทาง', amountSatang: 200_00 }],
      items: [
        { label: 'เดินทาง', suggestedSatang: 300_00 },
        { label: 'อาหาร', suggestedSatang: 500_00 },
        { label: 'ช้อปปิ้ง', suggestedSatang: 100_00 },
      ],
      selectedLabels: new Set(['เดินทาง', 'อาหาร']),
      operations: { update, add, remove },
    });

    expect(update).toHaveBeenCalledWith('travel', '300');
    expect(add).toHaveBeenCalledWith('budget-1', 'อาหาร', '500');
    expect(remove).not.toHaveBeenCalled();
    expect(result).toEqual([
      { id: 'travel', label: 'เดินทาง', amountSatang: 300_00 },
      { id: 'new-food', label: 'อาหาร', amountSatang: 500_00 },
    ]);
  });

  it('rolls completed writes back in reverse order when a later write fails', async () => {
    const writeOrder: string[] = [];
    const update = vi.fn(async (id: string, amount: string) => {
      writeOrder.push(`update:${id}:${amount}`);
      if (id === 'utilities') throw new Error('network failed');
    });
    const add = vi.fn(async () => {
      writeOrder.push('add:food');
      return { id: 'new-food', label: 'อาหาร', amountSatang: 500_00 };
    });
    const remove = vi.fn(async (id: string) => {
      writeOrder.push(`remove:${id}`);
    });

    await expect(applyBudgetPlan({
      budgetId: 'budget-1',
      categories: [
        { id: 'travel', label: 'เดินทาง', amountSatang: 200_00 },
        { id: 'utilities', label: 'สาธารณูปโภค', amountSatang: 100_00 },
      ],
      items: [
        { label: 'เดินทาง', suggestedSatang: 300_00 },
        { label: 'อาหาร', suggestedSatang: 500_00 },
        { label: 'สาธารณูปโภค', suggestedSatang: 150_00 },
      ],
      selectedLabels: new Set(['เดินทาง', 'อาหาร', 'สาธารณูปโภค']),
      operations: { update, add, remove },
    })).rejects.toThrow('network failed');

    expect(writeOrder).toEqual([
      'update:travel:300',
      'add:food',
      'update:utilities:150',
      'remove:new-food',
      'update:travel:200',
    ]);
  });
});
