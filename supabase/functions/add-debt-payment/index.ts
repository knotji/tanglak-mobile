// Supabase Edge Function: add-debt-payment
//
// Ported from tanglak's addDebtPayment (src/lib/data/finance-repository.ts).
// Unlike save-transaction, a debt payment is a three-part write: the
// transaction row, a debt_payments row, and a recalculation of the debt's
// amount_paid_this_cycle_satang (see _shared/debtCycle.ts) -- kept as its
// own function rather than folded into save-transaction because of that
// extra shape and the invariants specific to it:
//
//   - "Recording a debt payment must not automatically reduce
//     outstanding_balance_satang" -- this function never touches that
//     column, only amount_paid_this_cycle_satang (a display/progress
//     figure), matching the web app exactly.
//   - "Debt paid-this-cycle is cycle-scoped" -- amount_paid_this_cycle_satang
//     is *recomputed from scratch* by summing confirmed debt_payment
//     transactions inside the debt's current cycle window, never
//     incremented in place.
//   - "Every debt_payment transaction must reference a debt_id" -- enforced
//     by construction: this function is the only way the mobile client can
//     write a debt_payment transaction, and debt_id is required input.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { recalculateDebtPaidThisCycle } from '../_shared/debtCycle.ts';
import { writeDebtPaymentWithCompensation } from '../_shared/compensatingWrites.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function bahtToSatang(value: string | number): number {
  const normalized = String(value).replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) throw new Error('Invalid baht amount');
  const [bahtPart, satangPart = ''] = normalized.split('.');
  const sign = bahtPart.startsWith('-') ? -1 : 1;
  const absoluteBaht = Math.abs(Number(bahtPart));
  const satang = Number(satangPart.padEnd(2, '0'));
  return sign * (absoluteBaht * 100 + satang);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication Required' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Authentication Required' }, 401);

    const body = await request.json();

    const debtId = typeof body.debtId === 'string' && body.debtId ? body.debtId : '';
    if (!debtId) return json({ error: 'กรุณาเลือกหนี้ที่ต้องการจ่าย' }, 400);

    if (body.amount === undefined || body.amount === null || String(body.amount).trim() === '') {
      return json({ error: 'กรุณาระบุจำนวนเงิน' }, 400);
    }
    let amountSatang: number;
    try {
      amountSatang = bahtToSatang(body.amount);
    } catch {
      return json({ error: 'รูปแบบจำนวนเงินไม่ถูกต้อง' }, 400);
    }
    // A debt payment must be a real, positive payment -- matches
    // assertMoneySatang(..., "positive") in the web app's addDebtPayment.
    if (!Number.isFinite(amountSatang) || amountSatang <= 0) {
      return json({ error: 'จำนวนเงินต้องมากกว่า 0 บาท' }, 400);
    }

    const occurredAt = typeof body.occurredAt === 'string' ? body.occurredAt : '';
    const occurredAtDate = occurredAt ? new Date(occurredAt) : null;
    if (!occurredAt || !occurredAtDate || Number.isNaN(occurredAtDate.getTime())) {
      return json({ error: 'กรุณาระบุวันที่ทำรายการให้ถูกต้อง' }, 400);
    }
    const paidAtIso = occurredAtDate.toISOString();

    // Ownership check: RLS already limits reads to this user's own rows, so
    // a debtId belonging to someone else simply comes back empty here.
    const { data: debt, error: debtError } = await supabase
      .from('debts')
      .select('id, name')
      .eq('id', debtId)
      .eq('user_id', user.id)
      .neq('status', 'deleted')
      .maybeSingle();
    if (debtError || !debt) return json({ error: 'ไม่พบหนี้ที่เลือก' }, 404);

    const transactionId = await writeDebtPaymentWithCompensation({
      insertTransaction: async () => {
        const { data: transaction, error } = await supabase
          .from('transactions')
          .insert({
            user_id: user.id,
            type: 'debt_payment',
            status: 'confirmed',
            amount_satang: amountSatang,
            currency: 'THB',
            occurred_at: paidAtIso,
            merchant: `ชำระ ${debt.name}`,
            debt_id: debtId,
            source: 'manual',
          })
          .select('id')
          .single();
        if (error || !transaction) throw error ?? new Error('Transaction insert returned no row');
        return transaction.id;
      },
      insertPayment: async (createdTransactionId) => {
        const { error } = await supabase.from('debt_payments').insert({
          user_id: user.id,
          debt_id: debtId,
          transaction_id: createdTransactionId,
          amount_satang: amountSatang,
          paid_at: paidAtIso,
        });
        if (error) throw error;
      },
      recalculate: async () => {
        const { error } = await recalculateDebtPaidThisCycle(supabase, user.id, debtId);
        if (error) throw error;
      },
      deletePayment: async (createdTransactionId) => {
        const { error } = await supabase
          .from('debt_payments')
          .delete()
          .eq('transaction_id', createdTransactionId)
          .eq('user_id', user.id);
        if (error) throw error;
      },
      deleteTransaction: async (createdTransactionId) => {
        const { error } = await supabase
          .from('transactions')
          .delete()
          .eq('id', createdTransactionId)
          .eq('user_id', user.id);
        if (error) throw error;
      },
    });

    return json({ data: { transactionId } });
  } catch (error) {
    console.error('[add-debt-payment]', error);
    return json({ error: 'บันทึกการจ่ายหนี้ไม่สำเร็จ' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
