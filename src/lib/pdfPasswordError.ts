// Split out from pdfDecrypt.ts on purpose: this class needs to be
// statically importable for `instanceof` checks (e.g. in DebtImportModal)
// without pulling in pdfjs-dist itself, which is a large dependency that
// should only load when a PDF is actually being processed (see
// documentUpload.ts's dynamic import of pdfDecrypt.ts).
export type PdfPasswordErrorReason = 'need_password' | 'incorrect_password';

export class PdfPasswordError extends Error {
  constructor(public reason: PdfPasswordErrorReason) {
    super(reason === 'incorrect_password' ? 'รหัสผ่านไม่ถูกต้อง' : 'ไฟล์นี้มีรหัสผ่านป้องกันอยู่');
  }
}
