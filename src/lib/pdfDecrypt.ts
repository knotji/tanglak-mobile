// Renders a (possibly password-protected) PDF's pages to JPEG data URLs
// entirely on-device, using pdfjs-dist -- needed because the extraction
// pipeline (extract-document Edge Function) forwards whatever it's given
// straight to Gemini as inline data, and Gemini cannot open an encrypted
// PDF at all. Rendering to images sidesteps that: once decrypted here, the
// result is sent through the same image path every scanned photo already
// uses, so extract-document only needed to accept an array of images
// instead of one.
//
// Renders up to MAX_PAGES pages, not just the first -- an early version
// only rendered page 1, which silently failed for real NCB credit-bureau
// reports: page 1 is almost always a cover/requester-info page, with the
// actual account/balance table starting on page 2 or later. Sending
// several pages in one request lets Gemini combine information spread
// across pages (e.g. account holder info on one page, the balance table
// on another) the same way it already does for a single multi-field slip.
import { getDocument, GlobalWorkerOptions, PasswordResponses } from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { PdfPasswordError } from '@/lib/pdfPasswordError';

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const RENDER_SCALE = 1.8; // legible after JPEG compression; kept a bit below the single-page version's 2x since multiple pages now share the payload-size budget
const JPEG_QUALITY = 0.8;
const MAX_PAGES = 6; // enough to cover a cover page + several pages of trade-line detail on a typical NCB report, while keeping the combined request payload bounded

async function renderPageToJpeg(pdf: Awaited<ReturnType<typeof getDocument>['promise']>, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: RENDER_SCALE });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const canvasContext = canvas.getContext('2d');
  if (!canvasContext) throw new Error('เตรียมพื้นที่วาดรูปไม่สำเร็จ');
  await page.render({ canvasContext, canvas, viewport }).promise;
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY);
}

/**
 * `password` omitted (or undefined) first-tries opening the PDF unlocked --
 * a PDF that isn't actually encrypted opens fine with no password at all.
 * Only throws PdfPasswordError when pdf.js itself reports the document is
 * encrypted (need_password) or the given password was wrong
 * (incorrect_password); any other failure (corrupt file, unsupported PDF
 * feature) surfaces as a plain Error instead.
 */
export async function renderPdfPagesToJpeg(file: File, password?: string): Promise<string[]> {
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
    const pageCount = Math.min(pdf.numPages, MAX_PAGES);
    const pages: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      pages.push(await renderPageToJpeg(pdf, i));
    }
    return pages;
  } finally {
    void loadingTask.destroy();
  }
}
