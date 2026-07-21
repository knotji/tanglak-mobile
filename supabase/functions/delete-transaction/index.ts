// Supabase Edge Function: delete-transaction
//
// Deletes any transaction the caller owns. Not a simple client-side RLS
// delete (even though the generic "*_delete_own" RLS policy would allow
// one) because a debt_payment transaction's debt_id must trigger a
// recalculation of that debt's amount_paid_this_cycle_satang afterward --
// see _shared/debtCycle.ts. Ported from tanglak's deleteTransaction
// (src/lib/data/finance-repository.ts): read debt_id first, delete, then
// recalculate only if the deleted row had one.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { recalculateDebtPaidThisCycle } from '../_shared/debtCycle.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication Required' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Authentication Required' }, 401);

    const body = await request.json();
    const id = typeof body.id === 'string' && body.id ? body.id : '';
    if (!id) return json({ error: 'ไม่พบรายการที่ต้องการลบ' }, 400);

    const { data: existing, error: readError } = await supabase
      .from('transactions')
      .select('debt_id')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();
    if (readError) {
      console.error('[delete-transaction] read failed', readError.message);
      return json({ error: 'ลบรายการไม่สำเร็จ' }, 500);
    }
    if (!existing) return json({ error: 'ไม่พบรายการนี้' }, 404);

    const { error: deleteError } = await supabase.from('transactions').delete().eq('id', id).eq('user_id', user.id);
    if (deleteError) {
      console.error('[delete-transaction] delete failed', deleteError.message);
      return json({ error: 'ลบรายการไม่สำเร็จ' }, 500);
    }

    if (existing.debt_id) {
      const { error: recalcError } = await recalculateDebtPaidThisCycle(supabase, user.id, existing.debt_id);
      if (recalcError) console.error('[delete-transaction] recalc failed', recalcError);
    }

    return json({ data: { ok: true } });
  } catch (error) {
    console.error('[delete-transaction]', error);
    return json({ error: 'ลบรายการไม่สำเร็จ' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
