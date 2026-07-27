import { supabase } from '@/lib/supabaseClient';
import { PdfPasswordError } from '@/lib/pdfPasswordError';

export { PdfPasswordError };

export interface ExtractedTransaction {
  type?: 'income' | 'expense' | 'debt_payment' | 'transfer' | 'refund';
  amount?: number;
  currency?: string;
  occurredAt?: string;
  merchant?: string;
  categoryId?: string;
  categoryReason?: string;
  paymentMethod?: string;
  refNo?: string;
  bankChannel?: string;
  senderName?: string;
  receiverName?: string;
  memo?: string;
}

export interface ExtractedDebt {
  creditor?: string;
  debtName?: string;
  debtType?: 'credit_card' | 'personal_loan' | 'installment' | 'mortgage' | 'auto_loan' | 'buy_now_pay_later' | 'informal_loan' | 'other';
  outstandingBalance?: number;
  statementBalance?: number;
  amountDue?: number;
  minimumPayment?: number;
  dueDate?: string;
  interestRateAnnual?: number;
  remainingInstallments?: number;
  accountLastFour?: string;
}

export interface ExtractedFinancialDocument {
  documentType: 'salary_slip' | 'transfer_slip' | 'receipt' | 'delivery_receipt' | 'debt_statement' | 'loan_schedule' | 'other';
  confidence: number;
  transaction?: ExtractedTransaction;
  debt?: ExtractedDebt;
  warnings: string[];
  unclearFields: string[];
  requiresReview: true;
}

/** Resizes/compresses a single document photo to a JPEG data URL before sending it to the extraction function. */
async function prepareDocumentImage(file: File, maxDimension = 1600, quality = 0.82): Promise<string> {
  const original = await fileToDataUrl(file);
  const image = await loadImage(original);
  const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', quality);
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('อ่านไฟล์นี้ไม่ได้'));
    reader.readAsDataURL(file);
  });
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('เปิดรูปนี้ไม่ได้'));
    image.src = url;
  });
}

const MAX_COMBINED_PAYLOAD_CHARS = 15_000_000;

/**
 * `password` is only used for PDF files -- ignored for images. A PDF is
 * always rendered to JPEG images on-device first (via pdfjs-dist, up to
 * several pages -- see pdfDecrypt.ts) rather than forwarded to Gemini as
 * raw PDF bytes: this both lets a password-protected PDF be decrypted
 * client-side (Gemini has no way to open an encrypted PDF at all) and lets
 * information spread across pages (e.g. a cover/requester-info page
 * followed by the actual account/balance table, typical of an NCB
 * credit-bureau report) be combined into one extraction, the same way
 * Gemini already combines fields from a single multi-field slip. Throws
 * PdfPasswordError (re-exported from pdfPasswordError.ts) when the PDF
 * needs a password that wasn't given, or the given one was wrong --
 * callers should catch that specifically to prompt for a password rather
 * than showing a generic extraction-failed error.
 *
 * pdfDecrypt.ts (and the sizeable pdfjs-dist library it pulls in) is
 * dynamically imported here, only on the PDF branch -- it must never end
 * up in the eagerly-loaded MainTabs bundle just because this file is
 * statically imported by both UploadPage (images only, never triggers
 * this branch) and DebtImportModal (does).
 */
export async function extractDocument(file: File, password?: string): Promise<ExtractedFinancialDocument> {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) throw new Error('เลือกไฟล์รูปภาพหรือไฟล์ PDF เท่านั้น');
  // A PDF renders to one data URL per page (up to pdfDecrypt's own page
  // cap) -- a single image always sends its one page as a 1-element array,
  // so the Edge Function has one request shape to handle regardless of
  // source type.
  const imageDataUrls = isPdf
    ? await (await import('@/lib/pdfDecrypt')).renderPdfPagesToJpeg(file, password)
    : [await prepareDocumentImage(file)];
  const totalChars = imageDataUrls.reduce((sum, url) => sum + url.length, 0);
  if (totalChars > MAX_COMBINED_PAYLOAD_CHARS) throw new Error('ไฟล์นี้ใหญ่เกินไป กรุณาเลือกไฟล์ที่เล็กลง หรือมีจำนวนหน้าน้อยกว่านี้');
  const { data, error } = await supabase.functions.invoke('extract-document', { body: { imageDataUrls } });
  if (error) throw new Error('การอ่านเอกสารล้มเหลว กรุณาลองใหม่');
  if (!data?.data) throw new Error(data?.error ?? 'ไม่สามารถอ่านข้อมูลจากเอกสารนี้ได้');
  return data.data as ExtractedFinancialDocument;
}
