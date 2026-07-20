// Supabase Edge Function: save-transaction
//
// The write side of the slip-scan flow (see extract-document). Ported from
// tanglak's src/app/actions/finance.ts `saveTransactionAction` /
// src/lib/data/finance-repository.ts `createTransaction` -- same
// validation, same insert shape, same "confirmed" status and RLS-scoped
// client. This is a server-side re-validation step: the client (review
// screen) has already let the user edit/confirm the AI draft, but per
// docs/agent/FINANCIAL_INVARIANTS.md, client-side validation is never
// sufficient on its own -- amount and occurredAt are re-checked here
// before any write, and a validation failure never produces a partial row
// (the insert either fully succeeds or is rejected outright).
//
// Scope, deliberately: only type in (income, expense, transfer, refund).
// "debt_payment" requires a debt_id and this app doesn't have a debt
// picker yet -- rejected explicitly rather than half-supported.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ALLOWED_TYPES = new Set(['income', 'expense', 'transfer', 'refund']);

// --- Money parsing (ported from tanglak/src/lib/finance/money.ts + money-guards.ts) ---
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

    const type = typeof body.type === 'string' ? body.type : '';
    if (!ALLOWED_TYPES.has(type)) return json({ error: 'ประเภทรายการไม่ถูกต้อง' }, 400);

    if (body.amount === undefined || body.amount === null || String(body.amount).trim() === '') {
      return json({ error: 'กรุณาระบุจำนวนเงิน' }, 400);
    }
    let amountSatang: number;
    try {
      amountSatang = bahtToSatang(body.amount);
    } catch {
      return json({ error: 'รูปแบบจำนวนเงินไม่ถูกต้อง' }, 400);
    }
    if (!Number.isFinite(amountSatang) || amountSatang < 0) {
      return json({ error: 'จำนวนเงินต้องไม่ติดลบ' }, 400);
    }

    // A missing/unparseable occurredAt is never defaulted to "now" -- the
    // client must supply a value the user has confirmed (either the AI's
    // parsed date or a manual correction). Rejected outright otherwise.
    const occurredAt = typeof body.occurredAt === 'string' ? body.occurredAt : '';
    const occurredAtDate = occurredAt ? new Date(occurredAt) : null;
    if (!occurredAt || !occurredAtDate || Number.isNaN(occurredAtDate.getTime())) {
      return json({ error: 'กรุณาระบุวันที่ทำรายการให้ถูกต้อง' }, 400);
    }

    const merchant = typeof body.merchant === 'string' && body.merchant.trim() ? body.merchant.trim().slice(0, 200) : null;
    const categoryLabel = typeof body.categoryLabel === 'string' && body.categoryLabel.trim() ? body.categoryLabel.trim().slice(0, 100) : null;
    const paymentMethod = typeof body.paymentMethod === 'string' && body.paymentMethod.trim() ? body.paymentMethod.trim().slice(0, 100) : null;
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 1000) : null;

    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: user.id,
        type,
        status: 'confirmed',
        amount_satang: amountSatang,
        currency: 'THB',
        occurred_at: occurredAtDate.toISOString(),
        merchant,
        category_label: categoryLabel,
        payment_method: paymentMethod,
        note,
        source: 'ai_extraction',
      })
      .select('id, type, amount_satang, occurred_at, merchant, category_label')
      .single();

    if (error) {
      console.error('[save-transaction] insert failed', error.message);
      return json({ error: 'บันทึกรายการไม่สำเร็จ' }, 500);
    }

    return json({ data });
  } catch (error) {
    console.error('[save-transaction]', error);
    return json({ error: 'บันทึกรายการไม่สำเร็จ' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
