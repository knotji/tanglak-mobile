// Supabase Edge Function: extract-document
//
// Ported from tanglak (Next.js) src/lib/ai/{gemini,prompts,timestamp,schemas}.ts.
// Kept intentionally simpler than the web app's version: no claim/lease
// processing-state machine (that's tied to the Next.js `finance-repository`
// and Postgres document rows) and no multi-attempt retry/backoff — this
// takes an image straight from the client, calls Gemini once, and returns
// the normalized draft. The web app's document lifecycle (storage,
// retry/dedup, status transitions) is out of scope for this function.
//
// IMPORTANT (financial invariant, preserved from the web app): a document
// timestamp that cannot be confidently parsed is NEVER replaced with the
// current time. See parseDocumentTimestamp below.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://esm.sh/zod@3.23.8';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// --- Category catalog (id/label only -- trimmed from tanglak's
// src/lib/finance/categories.ts; only what the extraction prompt needs). ---
const EXPENSE_CATEGORY_IDS: Array<[string, string]> = [
  ['food', 'อาหารและเครื่องดื่ม'], ['groceries', 'ของใช้และซูเปอร์มาร์เก็ต'], ['transport', 'การเดินทาง'],
  ['housing', 'ที่อยู่อาศัย'], ['utilities', 'ค่าน้ำ ไฟ และสาธารณูปโภค'], ['debt', 'หนี้และสินเชื่อ'],
  ['health', 'สุขภาพและการแพทย์'], ['fitness', 'ออกกำลังกายและกีฬา'], ['personal_care', 'ดูแลตัวเอง'],
  ['shopping', 'ช้อปปิ้ง'], ['entertainment', 'ความบันเทิง'], ['subscriptions', 'สมาชิกและบริการรายเดือน'],
  ['travel', 'ท่องเที่ยว'], ['education', 'การศึกษาและพัฒนาตัวเอง'], ['family', 'ครอบครัวและคนสำคัญ'],
  ['gifts', 'ของขวัญและบริจาค'], ['insurance', 'ประกันภัย'], ['taxes_fees', 'ภาษีและค่าธรรมเนียม'],
  ['pets', 'สัตว์เลี้ยง'], ['work', 'ค่าใช้จ่ายเกี่ยวกับงาน'], ['transfers', 'โอนเงินและปรับยอด'], ['other', 'อื่น ๆ'],
];
const INCOME_CATEGORY_IDS: Array<[string, string]> = [
  ['salary', 'เงินเดือน'], ['freelance', 'งานเสริม/ฟรีแลนซ์'], ['bonus', 'โบนัส'], ['interest', 'ดอกเบี้ย/ผลตอบแทน'],
  ['refund', 'เงินคืน'], ['gift_income', 'เงินให้/เงินสนับสนุน'], ['sale', 'รายได้จากการขาย'], ['other_income', 'รายรับอื่น ๆ'],
];
const CATEGORY_ID_LIST = [...EXPENSE_CATEGORY_IDS, ...INCOME_CATEGORY_IDS]
  .map(([id, label]) => `${id} (${label})`)
  .join(', ');

const EXTRACTION_SYSTEM_PROMPT = `
You are an expert AI financial document parser for the TangLak (ตั้งหลัก) application.
Analyze the provided image(s) and extract the relevant fields into a single structured JSON object conforming exactly to the requested schema.

CRITICAL RULES:
1. Return STRICT JSON only. Do not wrap in markdown blocks like \`\`\`json or add conversational text. Start with { and end with }.
2. Perform NO calculation of final balances. Use the exact numbers printed in the document.
3. Keep requiresReview to true.
4. If a field is not present or cannot be read clearly, omit the field and append the field name (camelCase) to the "unclearFields" array.
5. All money amounts must be extracted as numbers (float/decimal format, e.g. 1500.50).
6. The "documentType" field must be one of: "salary_slip", "transfer_slip", "receipt", "delivery_receipt", "debt_statement", "other".
7. For "transaction.occurredAt": report the date/time exactly as printed on the document (e.g. "11 Jul 26 07:26 +0700", "11 July 2026", "2026-07-11T07:26:00+07:00"). Do NOT perform date/timezone conversion or arithmetic yourself. If you are not confident about the exact characters printed, omit the field and add "transaction.occurredAt" to "unclearFields" rather than guessing.
8. For "transaction.categoryId": choose exactly one id from this fixed list -- never invent a new id or use a label instead of an id: ${CATEGORY_ID_LIST}. Also set "transaction.categoryConfidence" (0 to 1) and a short "transaction.categoryReason". If nothing gives any signal, use "other" (or "other_income" for income) rather than guessing.
9. You may be given MULTIPLE images representing consecutive pages of the SAME document (e.g. a multi-page credit-bureau report). Treat them as one document and combine information across all pages into a single result -- for example, the account holder's name might be on page 1 (a cover/summary page) while the actual outstanding balance, minimum payment, and due date for a specific trade line are in a table on page 2 or later. Do not report only what's on the first page if a later page has the actual figures. If a report lists multiple separate credit accounts/trade lines, extract the one with the largest outstanding balance (the one most useful to plan around) and note in a warning that other accounts exist and were not extracted.

EXTRACTION SCHEMES BY DOCUMENT TYPE:
- "salary_slip": under "salary": employer, payPeriod, grossIncome, netIncome, tax, socialSecurity, deductions (array of {label, amount}). Under "transaction": type "income", amount = netIncome, occurredAt = payment date, merchant = employer.
- "receipt" / "delivery_receipt": under "receipt": subtotal, deliveryFee, serviceFee, discount, totalPaid, items (array of {name, quantity, amount}). Under "transaction": type "expense", amount = totalPaid, occurredAt, merchant, paymentMethod.
- "transfer_slip" (a bank-transfer/PromptPay confirmation screenshot): most of these are NOT a real fund transfer -- in Thailand, paying a shop, restaurant, or service by scanning a QR code or sending a bank transfer is extremely common and works exactly like paying by card, so decide "transaction.type" from what the destination actually is, not from the slip format alone:
  - Destination looks like a business/shop/restaurant/vendor/service (the most common case) -> type "expense", and pick the best matching categoryId for what was likely purchased.
  - Destination matches a credit card or loan company (e.g. KTC, Krungsri Consumer, Easy Buy, Aeon, Citi, CardX, SCB Card, or a bank's own credit/loan department) -> type "debt_payment", and also set possibleDebtPayment true.
  - Sender and destination appear to be the same person, or the slip has a self-transfer note (e.g. "โอนเข้าบัญชีตัวเอง") -> type "transfer", and also set possibleOwnAccountTransfer true.
  - Paying another individual person with no goods/service context (e.g. splitting a bill, sending money to family) -> type "transfer".
  - If genuinely unclear which of these applies, default to "expense" rather than "transfer" -- most transfer-shaped slips are purchases, not fund transfers.
  Always extract under "transaction" regardless of which type you chose: amount, occurredAt, merchant (destination name), referenceNumber, accountLastFour, destinationAccountLastFour, bank, possibleDebtPayment, possibleOwnAccountTransfer.
- "debt_statement": under "debt": creditor, debtName, debtType ("credit_card"|"personal_loan"|"installment"|"mortgage"|"auto_loan"|"buy_now_pay_later"|"informal_loan"|"other"), outstandingBalance, statementBalance, amountDue, minimumPayment, dueDate (YYYY-MM-DD), interestRateAnnual, remainingInstallments, accountLastFour.

Always check for handwriting, stamps, or barcodes. If confidence is low, set "confidence" lower (e.g. 0.5) and add warnings.
`;

// --- Timestamp normalization (ported verbatim in behavior from
// tanglak/src/lib/ai/timestamp.ts). Never falls back to current time. ---
type TimestampParseResult = { state: 'extracted' | 'inferred' | 'missing' | 'invalid'; iso?: string };

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6,
  jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
  'ม.ค.': 1, 'ก.พ.': 2, 'มี.ค.': 3, 'เม.ย.': 4, 'พ.ค.': 5, 'มิ.ย.': 6, 'ก.ค.': 7, 'ส.ค.': 8, 'ก.ย.': 9, 'ต.ค.': 10, 'พ.ย.': 11, 'ธ.ค.': 12,
  'มค': 1, 'กพ': 2, 'มีค': 3, 'เมย': 4, 'พค': 5, 'มิย': 6, 'กค': 7, 'สค': 8, 'กย': 9, 'ตค': 10, 'พย': 11, 'ธค': 12,
  'มกราคม': 1, 'กุมภาพันธ์': 2, 'มีนาคม': 3, 'เมษายน': 4, 'พฤษภาคม': 5, 'มิถุนายน': 6, 'กรกฎาคม': 7, 'สิงหาคม': 8, 'กันยายน': 9, 'ตุลาคม': 10, 'พฤศจิกายน': 11, 'ธันวาคม': 12,
};
const DEFAULT_TIMEZONE_OFFSET = '+07:00';
const ISO_LIKE_PATTERN = /^\d{4}-\d{2}-\d{2}([T\s]\d{2}:\d{2}(:\d{2})?(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/;
const TEXTUAL_DATE_PATTERN = /^(\d{1,2})\s+([A-Za-z฀-๿.]+)\s+(\d{2}|\d{4})(?:[,\s-]+(?:เวลา\s+)?(\d{1,2}):(\d{2}))?(?:\s*(Z|[+-]\d{2}:?\d{2}))?\s*$/;
const NUMERIC_DATE_PATTERN = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})(?:[,\sT]+(\d{1,2}):(\d{2}))?(?:\s*(Z|[+-]\d{2}:?\d{2}))?\s*$/;

function pad2(n: number) { return String(n).padStart(2, '0'); }
function normalizeOffset(raw?: string) { if (!raw || raw === 'Z') return raw === 'Z' ? 'Z' : DEFAULT_TIMEZONE_OFFSET; const c = raw.match(/^([+-])(\d{2})(\d{2})$/); return c ? `${c[1]}${c[2]}:${c[3]}` : raw; }
function resolveYear(yearStr: string) {
  let y = Number(yearStr);
  if (yearStr.length === 2) y = y > 40 ? (y + 2500) - 543 : y + 2000;
  else if (y > 2400) y -= 543;
  return y;
}
function isValidCalendarDate(year: number, month: number, day: number) { if (month < 1 || month > 12 || day < 1) return false; return day <= new Date(Date.UTC(year, month, 0)).getUTCDate(); }
function isValidTime(hour: number, minute: number) { return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59; }
function buildResult(year: number, month: number, day: number, hourStr?: string, minuteStr?: string, offsetStr?: string): TimestampParseResult {
  if (!isValidCalendarDate(year, month, day)) return { state: 'invalid' };
  const datePart = `${year}-${pad2(month)}-${pad2(day)}`;
  if (hourStr !== undefined && minuteStr !== undefined) {
    const hour = Number(hourStr), minute = Number(minuteStr);
    if (!isValidTime(hour, minute)) return { state: 'invalid' };
    return { state: 'extracted', iso: `${datePart}T${pad2(hour)}:${pad2(minute)}:00${normalizeOffset(offsetStr)}` };
  }
  return { state: 'inferred', iso: `${datePart}T12:00:00${DEFAULT_TIMEZONE_OFFSET}` };
}
function parseDocumentTimestamp(raw: unknown): TimestampParseResult {
  if (raw === undefined || raw === null) return { state: 'missing' };
  if (typeof raw !== 'string') return { state: 'invalid' };
  const trimmed = raw.trim();
  if (trimmed.length === 0) return { state: 'missing' };

  if (ISO_LIKE_PATTERN.test(trimmed)) {
    const hasTime = /[T\s]\d{2}:\d{2}/.test(trimmed);
    const hasOffset = /(Z|[+-]\d{2}:?\d{2})$/.test(trimmed);
    let normalized = trimmed.replace(' ', 'T');
    const beYearMatch = normalized.match(/^(\d{4})-/);
    if (beYearMatch && Number(beYearMatch[1]) > 2400) normalized = `${String(Number(beYearMatch[1]) - 543).padStart(4, '0')}${normalized.slice(4)}`;
    const probe = new Date(hasTime || hasOffset ? normalized : `${normalized}T00:00:00Z`);
    if (Number.isNaN(probe.getTime())) return { state: 'invalid' };
    if (!hasTime) return { state: 'inferred', iso: `${normalized}T12:00:00${DEFAULT_TIMEZONE_OFFSET}` };
    if (!hasOffset) return { state: 'extracted', iso: `${normalized}${DEFAULT_TIMEZONE_OFFSET}` };
    return { state: 'extracted', iso: normalized };
  }

  const textual = trimmed.match(TEXTUAL_DATE_PATTERN);
  if (textual) {
    const [, dayStr, monthStr, yearStr, hourStr, minuteStr, offsetStr] = textual;
    let monthKey = monthStr.toLowerCase();
    if (!MONTH_NAMES[monthKey] && monthKey.endsWith('.')) { const w = monthKey.slice(0, -1); if (MONTH_NAMES[w]) monthKey = w; }
    const month = MONTH_NAMES[monthKey];
    if (!month) return { state: 'invalid' };
    return buildResult(resolveYear(yearStr), month, Number(dayStr), hourStr, minuteStr, offsetStr);
  }

  const numeric = trimmed.match(NUMERIC_DATE_PATTERN);
  if (numeric) {
    const [, aStr, bStr, yearStr, hourStr, minuteStr, offsetStr] = numeric;
    const a = Number(aStr), b = Number(bStr), rawYear = Number(yearStr);
    if (yearStr.length === 4 && rawYear > 2400) return buildResult(resolveYear(yearStr), b, a, hourStr, minuteStr, offsetStr);
    let day: number, month: number;
    if (a > 12 && b <= 12) { day = a; month = b; }
    else if (b > 12 && a <= 12) { day = b; month = a; }
    else return { state: 'invalid' };
    return buildResult(resolveYear(yearStr), month, day, hourStr, minuteStr, offsetStr);
  }

  return { state: 'invalid' };
}

function normalizeParsedTimestamp(parsedJson: unknown): unknown {
  if (typeof parsedJson !== 'object' || parsedJson === null) return parsedJson;
  const root = parsedJson as { transaction?: unknown; unclearFields?: unknown };
  if (typeof root.transaction !== 'object' || root.transaction === null) return parsedJson;
  const transaction = root.transaction as { occurredAt?: unknown };
  const markNeedsReview = () => {
    if (Array.isArray(root.unclearFields)) { if (!root.unclearFields.includes('transaction.occurredAt')) root.unclearFields.push('transaction.occurredAt'); }
    else root.unclearFields = ['transaction.occurredAt'];
  };
  if (!('occurredAt' in transaction)) { markNeedsReview(); return parsedJson; }
  const result = parseDocumentTimestamp(transaction.occurredAt);
  if (result.state === 'extracted' || result.state === 'inferred') transaction.occurredAt = result.iso;
  else { delete transaction.occurredAt; markNeedsReview(); }
  return parsedJson;
}

// --- Defensive coercion for common Gemini JSON-mode quirks, applied before
// Zod validation. Gemini's structured output is usually clean but reliably
// drifts from the requested schema in a few specific ways on real-world
// documents (dense official reports especially, e.g. NCB credit-bureau
// statements): money amounts occasionally come back as locale-formatted
// strings ("15,000.00") instead of numbers, "I don't know" is sometimes
// expressed as an explicit `null` rather than omitting the key (which
// z.optional() doesn't accept -- only `undefined` satisfies "absent"), and
// confidence scores sometimes come back as a 0-100 percentage instead of
// the requested 0-1 fraction. None of these are malformed JSON or a wrong
// field name (Zod would still reject those, correctly) -- they're just
// off-schema encodings of otherwise-correct data, worth normalizing rather
// than discarding.

/** Recursively replaces every `null` with `undefined` so it satisfies z.optional() fields instead of failing them -- Gemini uses `null` for "I don't know" fairly often even when the prompt says to omit the key instead. */
function deepNullToUndefined(value: unknown): unknown {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(deepNullToUndefined);
  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) result[key] = deepNullToUndefined(val);
    return result;
  }
  return value;
}

/** Accepts a number as-is; for a string, strips currency symbols/thousands separators (e.g. "฿15,000.00" -> 15000) before parsing. Falls through unchanged if it doesn't look numeric at all, so Zod still reports a clear error for genuinely wrong data. */
const moneyLike = () => z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/[^\d.-]/g, '');
  if (cleaned === '' || cleaned === '-') return value;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : value;
}, z.number().nonnegative().optional());

/** Same string-to-number coercion as moneyLike, for a plain count (e.g. line-item quantity, remaining installments) -- takes the specific numeric constraint (int/positive/nonnegative) as a parameter since those differ per field. */
const countLike = (schema: z.ZodNumber) => z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const cleaned = value.replace(/[^\d-]/g, '');
  if (cleaned === '' || cleaned === '-') return value;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : value;
}, schema.optional());

/** Same string-cleanup as moneyLike, but also folds an apparent 0-100 percentage down to 0-1 (Gemini sometimes returns confidence as "85" meaning 85%, despite the prompt asking for a 0-1 fraction). */
const confidenceLike = () => z.preprocess((value) => {
  let n: number | undefined;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string') { const parsed = Number(value.replace(/[^\d.-]/g, '')); n = Number.isFinite(parsed) ? parsed : undefined; }
  if (n === undefined) return value;
  return n > 1 ? n / 100 : n;
}, z.number().min(0).max(1).optional());

// --- Schema (ported from tanglak/src/lib/ai/schemas.ts) ---
const extractedFinancialDocumentSchema = z.object({
  documentType: z.enum(['salary_slip', 'transfer_slip', 'receipt', 'delivery_receipt', 'debt_statement', 'loan_schedule', 'other']),
  confidence: confidenceLike().default(0),
  transaction: z.object({
    type: z.enum(['income', 'expense', 'debt_payment', 'transfer', 'refund']).optional(),
    amount: moneyLike(),
    currency: z.string().optional(),
    occurredAt: z.string().optional(),
    merchant: z.string().optional(),
    category: z.string().optional(),
    categoryId: z.string().optional(),
    categoryConfidence: confidenceLike(),
    categoryReason: z.string().optional(),
    alternativeCategoryId: z.string().optional(),
    paymentMethod: z.string().optional(),
    referenceNumber: z.string().optional(),
    accountLastFour: z.string().optional(),
    destinationAccountLastFour: z.string().optional(),
    bank: z.string().optional(),
    possibleDebtPayment: z.boolean().optional(),
    possibleOwnAccountTransfer: z.boolean().optional(),
  }).optional(),
  salary: z.object({
    employer: z.string().optional(), payPeriod: z.string().optional(), grossIncome: moneyLike(),
    netIncome: moneyLike(), tax: moneyLike(), socialSecurity: moneyLike(),
    deductions: z.array(z.object({ label: z.string(), amount: moneyLike() })).optional(),
  }).optional(),
  receipt: z.object({
    subtotal: moneyLike(), deliveryFee: moneyLike(), serviceFee: moneyLike(),
    discount: moneyLike(), totalPaid: moneyLike(),
    items: z.array(z.object({ name: z.string(), quantity: countLike(z.number().positive()), amount: moneyLike() })).optional(),
  }).optional(),
  debt: z.object({
    creditor: z.string().optional(), debtName: z.string().optional(),
    debtType: z.enum(['credit_card', 'personal_loan', 'installment', 'mortgage', 'auto_loan', 'buy_now_pay_later', 'informal_loan', 'other']).optional(),
    outstandingBalance: moneyLike(), statementBalance: moneyLike(), amountDue: moneyLike(),
    minimumPayment: moneyLike(), dueDate: z.string().optional(), interestRateAnnual: moneyLike(),
    remainingInstallments: countLike(z.number().int().nonnegative()), accountLastFour: z.string().optional(),
  }).optional(),
  warnings: z.array(z.string()).default([]),
  unclearFields: z.array(z.string()).default([]),
  requiresReview: z.literal(true).default(true),
});

// --- HTTP handler ---
Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Authentication Required' }, 401);
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authorization } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Authentication Required' }, 401);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'Document Extraction Is Not Configured' }, 503);

    const body = await request.json();
    // imageDataUrls (plural) is the current shape -- one data URL per PDF
    // page, or a single-element array for a plain photo. imageDataUrl
    // (singular) is accepted as a fallback for any client build still
    // sending the old single-image shape.
    const rawUrls: unknown = Array.isArray(body.imageDataUrls)
      ? body.imageDataUrls
      : typeof body.imageDataUrl === 'string' ? [body.imageDataUrl] : [];
    const DATA_URL_PATTERN = /^data:(image\/[a-zA-Z0-9.+-]+|application\/pdf);base64,(.+)$/;
    const images = (rawUrls as unknown[])
      .filter((u): u is string => typeof u === 'string')
      .map((u) => u.match(DATA_URL_PATTERN))
      .filter((m): m is RegExpMatchArray => m !== null)
      .map((m) => ({ mimeType: m[1], base64: m[2] }));
    if (images.length === 0) return json({ error: 'A Valid Document Image Is Required' }, 400);

    const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.1-flash-lite';
    const introText = images.length > 1
      ? `Here is the document to extract, as ${images.length} consecutive pages. Combine information across all pages into a single result (e.g. account/requester info on one page, a balance or account table on another).`
      : 'Here is the document to extract.';
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: introText },
            ...images.map((img) => ({ inline_data: { mime_type: img.mimeType, data: img.base64 } })),
          ],
        }],
        systemInstruction: { parts: [{ text: EXTRACTION_SYSTEM_PROMPT }] },
        generationConfig: { response_mime_type: 'application/json' },
      }),
    });
    if (!response.ok) {
      console.error('[extract-document] Gemini API error', response.status, await response.text().catch(() => '<unreadable body>'));
      return json({ error: 'Document Extraction Failed' }, 502);
    }

    const result = await response.json();
    const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      console.error('[extract-document] no text in Gemini response', JSON.stringify(result).slice(0, 2000));
      return json({ error: 'Document Extraction Returned No Result' }, 502);
    }

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text.trim());
    } catch {
      console.error('[extract-document] Gemini did not return valid JSON', text.slice(0, 2000));
      return json({ error: 'Document Extraction Returned Invalid JSON' }, 502);
    }

    // See the coercion helpers above (deepNullToUndefined, moneyLike,
    // confidenceLike) -- normalizes the handful of ways Gemini's structured
    // output reliably drifts from the requested schema before validating.
    const parseResult = extractedFinancialDocumentSchema.safeParse(normalizeParsedTimestamp(deepNullToUndefined(parsedJson)));
    if (!parseResult.success) {
      // Logged (not returned to the client) so a real failure is
      // diagnosable from the Supabase dashboard's function logs instead of
      // being a total black box -- this was previously swallowed entirely.
      console.error('[extract-document] schema validation failed', JSON.stringify(parseResult.error.issues), 'raw:', JSON.stringify(parsedJson).slice(0, 2000));
      return json({ error: 'Document Extraction Result Did Not Match Expected Shape' }, 502);
    }

    return json({ data: parseResult.data });
  } catch (error) {
    console.error('[extract-document]', error);
    return json({ error: 'Document Extraction Failed' }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
