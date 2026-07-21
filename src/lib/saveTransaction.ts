import { supabase } from '@/lib/supabaseClient';

export interface SaveTransactionInput {
  id?: string;
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

export async function deleteTransaction(id: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke('delete-transaction', { body: { id } });
  if (error) throw new Error('ลบรายการไม่สำเร็จ กรุณาลองใหม่');
  if (data?.error) throw new Error(data.error);
}
