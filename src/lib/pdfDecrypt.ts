// Renders a (possibly password-protected) PDF's first page to a JPEG data
// URL entirely on-device, using pdfjs-dist -- needed because the
// extraction pipeline (extract-document Edge Function) forwards whatever
// it's given straight to Gemini as inline data, and Gemini cannot open an
// encrypted PDF at all. Rendering to an image sidesteps that: once
// decrypted here, the result is sent through the exact same image path
// every scanned photo already uses, so extract-document itself needed no
// changes.
//
// Only the first page is rendered -- this app's extraction pipeline takes
// a single image per call, and NCB credit-bureau reports/e-statements put
// the account summary (balance, minimum, due date) on page 1.
import { getDocument, GlobalWorkerOptions, PasswordResponses } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PdfPasswordError } from '@/lib/pdfPasswordError';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RENDER_SCALE = 2; // higher than 1:1 so text stays legible after JPEG compression
const JPEG_QUALITY = 0.85;

/**
 * `password` omitted (or undefined) first-tries opening the PDF unlocked --
 * a PDF that isn't actually encrypted opens fine with no password at all.
 * Only throws PdfPasswordError when pdf.js itself reports the document is
 * encrypted (need_password) or the given password was wrong
 * (incorrect_password); any other failure (corrupt file, unsupported PDF
 * feature) surfaces as a plain Error instead.
 */
export async function renderPdfFirstPageToJpeg(file: File, password?: string): Promise<string> {
  const data = await file.arrayBuffer();
  const loadingTask = getDocument({ data, password });

  let pdf;
  try {
    pdf = await loadingTask.promise;
  } catch (cause) {
    if (cause && typeof cause === 'object' && 'name' in cause && cause.name === 'PasswordException' && 'code' in cause) {
      const code = (cause as { code: number }).code;
      throw new PdfPasswordError(code === PasswordResponses.INCORRECT_PASSWORD ? 'incorrect_password' : 'need_password');
    }
    throw new Error('เปิดไฟล์ PDF นี้ไม่ได้ ไฟล์อาจเสียหายหรือไม่รองรับ');
  }

  try {
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: RENDER_SCALE });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const canvasContext = canvas.getContext('2d');
    if (!canvasContext) throw new Error('เตรียมพื้นที่วาดรูปไม่สำเร็จ');

    await page.render({ canvasContext, canvas, viewport }).promise;
    return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  } finally {
    void loadingTask.destroy();
  }
}
