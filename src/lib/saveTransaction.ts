import { supabase } from '@/lib/supabaseClient';

export interface SaveTransactionInput {
  type: 'income' | 'expense' | 'transfer' | 'refund';
  amount: number;
  occurredAt: string;
  merchant?: string;
  categoryLabel?: string;
  paymentMethod?: string;
  note?: string;
}

export async function saveTransaction(input: SaveTransactionInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('save-transaction', { body: input });
  if (error) throw new Error('บันทึกรายการไม่สำเร็จ กรุณาลองใหม่');
  if (data?.error) throw new Error(data.error);
}
