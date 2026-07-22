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

export interface ExtractedFinancialDocument {
  documentType: 'salary_slip' | 'transfer_slip' | 'receipt' | 'delivery_receipt' | 'debt_statement' | 'loan_schedule' | 'other';
  confidence: number;
  transaction?: ExtractedTransaction;
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
    reader.onerror = () => reject(new Error('อ่านไฟล์รูปนี้ไม่ได้'));
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
  if (!file.type.startsWith('image/')) throw new Error('เลือกไฟล์รูปภาพเท่านั้น');
  const imageDataUrl = await prepareDocumentImage(file);
  if (imageDataUrl.length > 5_500_000) throw new Error('รูปนี้ใหญ่เกินไป ลองถ่ายใหม่หรือเลือกรูปอื่น');
  const { data, error } = await supabase.functions.invoke('extract-document', { body: { imageDataUrl } });
  if (error) throw new Error('การอ่านสลิปล้มเหลว กรุณาลองใหม่');
  if (!data?.data) throw new Error(data?.error ?? 'ไม่สามารถอ่านข้อมูลจากสลิปนี้ได้');
  return data.data as ExtractedFinancialDocument;
}
