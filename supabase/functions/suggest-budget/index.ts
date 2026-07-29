import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const inputSchema = z.object({
  monthlyIncomeSatang: z.number().int().positive().max(1_000_000_000),
  history: z.array(z.object({
    month: z.string().regex(/^\d{4}-\d{2}$/),
    totalExpenseSatang: z.number().int().nonnegative(),
    categories: z.array(z.object({
      categoryId: z.string().min(1).max(80),
      label: z.string().min(1).max(120),
      spentSatang: z.number().int().nonnegative(),
    })).max(50),
  })).min(1).max(6),
  currentBudgets: z.array(z.object({
    categoryId: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
    amountSatang: z.number().int().nonnegative(),
  })).max(50),
  availableCategories: z.array(z.object({
    id: z.string().min(1).max(80),
    label: z.string().min(1).max(120),
  })).min(1).max(50),
});

const outputSchema = z.object({
  summary: z.string().min(1).max(500),
  savingsSatang: z.number().int().nonnegative(),
  items: z.array(z.object({
    categoryId: z.string().min(1).max(80),
    suggestedSatang: z.number().int().positive(),
    reason: z.string().min(1).max(240),
  })).min(1).max(30),
});

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method Not Allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication Required' }, 401);
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authorization } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Authentication Required' }, 401);

    const inputResult = inputSchema.safeParse(await request.json());
    if (!inputResult.success) return json({ error: 'ข้อมูลสำหรับวางแผนงบไม่ถูกต้อง' }, 400);
    const input = inputResult.data;

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'AI ยังไม่ได้ตั้งค่าบนเซิร์ฟเวอร์' }, 503);
    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
    const categoryCatalog = input.availableCategories.map((item) => `${item.id}: ${item.label}`).join('\n');
    const prompt = `
คุณเป็นผู้ช่วยวางงบประมาณรายเดือนภาษาไทยสำหรับแอป TangLak
วิเคราะห์ข้อมูลสรุปเท่านั้นและสร้างแผนงบที่ทำได้จริง

กติกาบังคับ:
- ตอบ JSON เท่านั้น: {"summary":"...","savingsSatang":0,"items":[{"categoryId":"food","suggestedSatang":100000,"reason":"..."}]}
- เงินทุกจำนวนเป็นสตางค์และต้องเป็นจำนวนเต็ม
- ใช้ categoryId จากรายการที่อนุญาตเท่านั้น ห้ามสร้างหมวดใหม่
- ห้ามให้ categoryId ซ้ำ
- ยอดรวม items + savingsSatang ต้องไม่เกิน monthlyIncomeSatang
- กันเงินออม/เงินเผื่อฉุกเฉินอย่างสมเหตุผลเมื่อรายรับเพียงพอ
- ใช้ประวัติจริงเป็นหลัก ปรับลดหมวดที่ผันผวนหรือไม่จำเป็นได้
- reason และ summary ใช้ภาษาไทย กระชับ และไม่ตัดสินผู้ใช้

หมวดที่อนุญาต:
${categoryCatalog}

ข้อมูล:
${JSON.stringify({
  monthlyIncomeSatang: input.monthlyIncomeSatang,
  history: input.history,
  currentBudgets: input.currentBudgets,
})}
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { response_mime_type: 'application/json', temperature: 0.2 },
      }),
    });
    if (!response.ok) {
      console.error('[suggest-budget] Gemini API error', response.status, await response.text().catch(() => '<unreadable>'));
      return json({ error: 'AI ยังวิเคราะห์งบไม่ได้ กรุณาลองใหม่' }, 502);
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') return json({ error: 'AI ไม่ส่งแผนงบกลับมา' }, 502);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      return json({ error: 'AI ส่งแผนงบที่อ่านไม่ได้' }, 502);
    }
    const outputResult = outputSchema.safeParse(parsed);
    if (!outputResult.success) return json({ error: 'AI ส่งแผนงบที่ไม่สมบูรณ์' }, 502);

    const allowed = new Map(input.availableCategories.map((item) => [item.id, item.label]));
    const seen = new Set<string>();
    let allocated = outputResult.data.savingsSatang;
    const items = [];
    for (const item of outputResult.data.items) {
      const label = allowed.get(item.categoryId);
      if (!label || seen.has(item.categoryId)) return json({ error: 'AI ส่งหมวดงบที่ไม่ถูกต้อง' }, 502);
      seen.add(item.categoryId);
      allocated += item.suggestedSatang;
      items.push({ ...item, label });
    }
    if (allocated > input.monthlyIncomeSatang) return json({ error: 'แผนจาก AI ใช้เงินเกินรายรับ' }, 502);

    return json({ data: { ...outputResult.data, items } });
  } catch (error) {
    console.error('[suggest-budget]', error);
    return json({ error: 'AI ยังวิเคราะห์งบไม่ได้ กรุณาลองใหม่' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
