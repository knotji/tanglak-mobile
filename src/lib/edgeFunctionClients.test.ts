import { beforeEach, describe, expect, it, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    functions: { invoke },
  },
}));

import {
  deleteTransaction,
  saveTransaction,
  type SaveTransactionInput,
} from '@/lib/saveTransaction';

describe('Edge Function clients', () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  describe('saveTransaction', () => {
    const input: SaveTransactionInput = {
      type: 'expense',
      amount: 99.5,
      occurredAt: '2026-07-28T17:00:00.000Z',
      merchant: 'ร้านทดสอบ',
      categoryLabel: 'อาหาร',
    };

    it('passes the complete reviewed transaction to the write boundary', async () => {
      invoke.mockResolvedValue({ data: { id: 'tx-2' }, error: null });

      await saveTransaction(input);

      expect(invoke).toHaveBeenCalledWith('save-transaction', { body: input });
    });

    it('surfaces backend validation without replacing it with a generic error', async () => {
      invoke.mockResolvedValue({
        data: { error: 'กรุณาระบุวันที่ทำรายการให้ถูกต้อง' },
        error: null,
      });

      await expect(saveTransaction(input)).rejects.toThrow(
        'กรุณาระบุวันที่ทำรายการให้ถูกต้อง',
      );
    });
  });

  describe('deleteTransaction', () => {
    it('sends only the selected transaction id', async () => {
      invoke.mockResolvedValue({ data: { ok: true }, error: null });

      await deleteTransaction('tx-3');

      expect(invoke).toHaveBeenCalledWith('delete-transaction', {
        body: { id: 'tx-3' },
      });
    });

    it('rejects transport and backend failures', async () => {
      invoke
        .mockResolvedValueOnce({ data: null, error: new Error('offline') })
        .mockResolvedValueOnce({ data: { error: 'ไม่พบรายการนี้' }, error: null });

      await expect(deleteTransaction('tx-3')).rejects.toThrow(
        'ลบรายการไม่สำเร็จ กรุณาลองใหม่',
      );
      await expect(deleteTransaction('tx-3')).rejects.toThrow('ไม่พบรายการนี้');
    });
  });
});
