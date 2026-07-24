import { supabase } from '@/lib/supabaseClient';

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
  if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
    return original;
  }
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

export async function extractDocument(file: File): Promise<ExtractedFinancialDocument> {
  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isImage && !isPdf) throw new Error('เลือกไฟล์รูปภาพหรือไฟล์ PDF เท่านั้น');
  const imageDataUrl = await prepareDocumentImage(file);
  if (imageDataUrl.length > 7_500_000) throw new Error('ไฟล์นี้ใหญ่เกินไป กรุณาเลือกไฟล์ที่เล็กลง');
  const { data, error } = await supabase.functions.invoke('extract-document', { body: { imageDataUrl } });
  if (error) throw new Error('การอ่านเอกสารล้มเหลว กรุณาลองใหม่');
  if (!data?.data) throw new Error(data?.error ?? 'ไม่สามารถอ่านข้อมูลจากเอกสารนี้ได้');
  return data.data as ExtractedFinancialDocument;
}
