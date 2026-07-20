// Supabase Edge Function: add-debt-payment
//
// Ported from tanglak's addDebtPayment + recalculateDebtPaidThisCycle
// (src/lib/data/finance-repository.ts) and getDebtCycleWindow
// (src/lib/finance/date.ts). Unlike save-transaction, a debt payment is a
// three-part write: the transaction row, a debt_payments row, and a
// recalculation of the debt's amount_paid_this_cycle_satang -- kept as its
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
//     incremented in place. Same cycle-window logic as the web app
//     (explicit cycle_start_date/cycle_end_date if set, else the current
//     Bangkok calendar month).
//   - "Every debt_payment transaction must reference a debt_id" -- enforced
//     by construction: this function is the only way the mobile client can
//     write a debt_payment transaction, and debt_id is required input.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

// --- Cycle window (ported from tanglak/src/lib/finance/date.ts) ---
function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
function shiftDateKey(dateKey: string, offsetDays: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + offsetDays)).toISOString().slice(0, 10);
}
function bangkokDateStartInstant(dateKey: string): string {
  return `${dateKey}T00:00:00+07:00`;
}
function getBangkokTodayString(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function getDebtCycleWindow(debt: { cycle_start_date: string | null; cycle_end_date: string | null }, today: Date) {
  if (debt.cycle_start_date && debt.cycle_end_date && isValidDateKey(debt.cycle_start_date) && isValidDateKey(debt.cycle_end_date)) {
    return {
      startInstant: bangkokDateStartInstant(debt.cycle_start_date),
      endExclusiveInstant: bangkokDateStartInstant(shiftDateKey(debt.cycle_end_date, 1)),
    };
  }
  const todayKey = getBangkokTodayString(today);
  const [year, month] = todayKey.split('-').map(Number);
  const startDate = `${todayKey.slice(0, 7)}-01`;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const endDate = `${todayKey.slice(0, 7)}-${String(daysInMonth).padStart(2, '0')}`;
  return { startInstant: bangkokDateStartInstant(startDate), endExclusiveInstant: bangkokDateStartInstant(shiftDateKey(endDate, 1)) };
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
      .select('id, name, cycle_start_date, cycle_end_date')
      .eq('id', debtId)
      .eq('user_id', user.id)
      .neq('status', 'deleted')
      .maybeSingle();
    if (debtError || !debt) return json({ error: 'ไม่พบหนี้ที่เลือก' }, 404);

    const { data: transaction, error: txError } = await supabase
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
    if (txError || !transaction) {
      console.error('[add-debt-payment] transaction insert failed', txError?.message);
      return json({ error: 'บันทึกการจ่ายหนี้ไม่สำเร็จ' }, 500);
    }

    const { error: paymentError } = await supabase.from('debt_payments').insert({
      user_id: user.id,
      debt_id: debtId,
      transaction_id: transaction.id,
      amount_satang: amountSatang,
      paid_at: paidAtIso,
    });
    if (paymentError) {
      console.error('[add-debt-payment] debt_payments insert failed', paymentError.message);
      return json({ error: 'บันทึกการจ่ายหนี้ไม่สำเร็จ' }, 500);
    }

    // Recompute amount_paid_this_cycle_satang from scratch (cycle-scoped,
    // never incremented in place) -- never touches outstanding_balance_satang.
    const cycle = getDebtCycleWindow(debt, new Date());
    const { data: cycleRows, error: sumError } = await supabase
      .from('transactions')
      .select('amount_satang')
      .eq('user_id', user.id)
      .eq('debt_id', debtId)
      .eq('type', 'debt_payment')
      .eq('status', 'confirmed')
      .gte('occurred_at', cycle.startInstant)
      .lt('occurred_at', cycle.endExclusiveInstant);
    if (sumError) {
      console.error('[add-debt-payment] cycle sum query failed', sumError.message);
      return json({ error: 'บันทึกการจ่ายหนี้ไม่สำเร็จ' }, 500);
    }
    const total = (cycleRows ?? []).reduce((sum, row) => sum + Number(row.amount_satang), 0);
    const { error: updateError } = await supabase
      .from('debts')
      .update({ amount_paid_this_cycle_satang: total })
      .eq('id', debtId)
      .eq('user_id', user.id)
      .neq('status', 'deleted');
    if (updateError) {
      console.error('[add-debt-payment] cycle update failed', updateError.message);
      return json({ error: 'บันทึกการจ่ายหนี้ไม่สำเร็จ' }, 500);
    }

    return json({ data: { transactionId: transaction.id } });
  } catch (error) {
    console.error('[add-debt-payment]', error);
    return json({ error: 'บันทึกการจ่ายหนี้ไม่สำเร็จ' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
