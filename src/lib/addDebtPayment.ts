import { supabase } from '@/lib/supabaseClient';

export interface AddDebtPaymentInput {
  debtId: string;
  amount: number;
  occurredAt: string;
}

export async function addDebtPayment(input: AddDebtPaymentInput): Promise<void> {
  const { data, error } = await supabase.functions.invoke('add-debt-payment', { body: input });
  if (error) throw new Error('บันทึกการจ่ายหนี้ไม่สำเร็จ กรุณาลองใหม่');
  if (data?.error) throw new Error(data.error);
}
