import { useState } from 'react';
import {
  IonButton,
  IonIcon,
  IonInput,
  IonModal,
  IonSpinner,
  IonText,
} from '@ionic/react';
import { cloudUploadOutline, documentTextOutline, checkmarkCircleOutline, sparklesOutline, lockClosedOutline } from 'ionicons/icons';
import FieldLabel from '@/components/FieldLabel';
import DateField from '@/components/DateField';
import { extractDocument, PdfPasswordError, type ExtractedDebt } from '@/lib/documentUpload';
import { createDebt, type DebtFormInput } from '@/lib/debts';

interface DebtImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDebtImported: () => void;
}

const EMPTY_FORM: DebtFormInput = {
  name: '',
  creditor: '',
  outstanding: '',
  amountDue: '',
  minimum: '',
  dueDate: '',
  recurringDueDay: '',
  paymentMode: 'variable_monthly',
  interestRateAnnual: '',
  notes: '',
};

export const DebtImportModal: React.FC<DebtImportModalProps> = ({ isOpen, onClose, onDebtImported }) => {
  const [step, setStep] = useState<'pick' | 'password' | 'extracting' | 'review' | 'saving' | 'saved'>('pick');
  const [form, setForm] = useState<DebtFormInput>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');

  const handleReset = () => {
    setStep('pick');
    setForm(EMPTY_FORM);
    setError('');
    setFileName('');
    setPendingFile(null);
    setPassword('');
  };

  const runExtraction = async (file: File, filePassword?: string) => {
    setError('');
    setStep('extracting');
    try {
      const extracted = await extractDocument(file, filePassword);
      const debtData: ExtractedDebt = extracted.debt ?? {};
      const txData = extracted.transaction;

      const debtName = debtData.debtName || debtData.creditor || txData?.merchant || 'สินเชื่อ';
      const creditor = debtData.creditor || txData?.merchant || '';
      const outstanding = debtData.outstandingBalance !== undefined ? String(debtData.outstandingBalance) : (debtData.statementBalance !== undefined ? String(debtData.statementBalance) : '');
      const amountDue = debtData.amountDue !== undefined ? String(debtData.amountDue) : (txData?.amount !== undefined ? String(txData.amount) : '');
      const minimum = debtData.minimumPayment !== undefined ? String(debtData.minimumPayment) : amountDue;
      const dueDate = debtData.dueDate || (txData?.occurredAt ? txData.occurredAt.slice(0, 10) : '');
      const recurringDueDay = dueDate ? String(Number(dueDate.split('-')[2])) : '';
      const interestRateAnnual = debtData.interestRateAnnual !== undefined ? String(debtData.interestRateAnnual) : '';

      setForm({
        name: debtName,
        creditor,
        outstanding,
        amountDue,
        minimum,
        dueDate,
        recurringDueDay,
        paymentMode: 'variable_monthly',
        interestRateAnnual,
        notes: `นำเข้าจากเอกสาร ${file.name}`,
      });
      setPendingFile(null);
      setStep('review');
    } catch (cause) {
      if (cause instanceof PdfPasswordError) {
        // "need_password" (first attempt, no password given) and
        // "incorrect_password" (a password was already tried) both land on
        // the same password step -- only the inline error message differs,
        // so a wrong guess doesn't force the user to re-pick the file.
        setPendingFile(file);
        setError(cause.reason === 'incorrect_password' ? cause.message : '');
        setStep('password');
        return;
      }
      setError(cause instanceof Error ? cause.message : 'อ่านข้อมูลหนี้จากไฟล์ไม่สำเร็จ');
      setStep('pick');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setFileName(file.name);
    setPassword('');
    await runExtraction(file);
  };

  const handlePasswordSubmit = async () => {
    if (!pendingFile || !password) return;
    await runExtraction(pendingFile, password);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('กรุณาระบุชื่อหนี้สิน');
      return;
    }
    setError('');
    setStep('saving');
    try {
      await createDebt(form);
      setStep('saved');
      onDebtImported();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกหนี้ไม่สำเร็จ');
      setStep('review');
    }
  };

  return (
    <IonModal className="tl-compact-modal" isOpen={isOpen} onDidDismiss={() => { handleReset(); onClose(); }}>
      <div style={{ padding: '20px 20px 28px' }}>
        <div style={{ width: 36, height: 4, borderRadius: 999, background: '#cbd5e1', margin: '0 auto 14px' }} />

        {step === 'pick' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 18,
                  background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%)',
                  color: '#4f46e5',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <IonIcon icon={documentTextOutline} style={{ fontSize: 28 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>นำเข้าหนี้จาก NCB / Statement</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--tl-text-secondary)', lineHeight: 1.4 }}>
                อัปโหลดไฟล์ PDF รายงานเครดิตบูโร หรือรูปภาพใบแจ้งหนี้ AI จะอ่านข้อมูลให้ทันที
              </p>
            </div>

            <label
              className="upload-picker"
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '32px 16px',
                border: '2px dashed #818cf8',
                borderRadius: 18,
                background: '#f8fafc',
                textAlign: 'center',
              }}
            >
              <IonIcon icon={cloudUploadOutline} style={{ fontSize: 36, color: '#4f46e5', marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#0f172a' }}>เลือกไฟล์ PDF หรือรูปภาพ</p>
              <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)' }}>รองรับไฟล์ .pdf, .jpg, .png</p>
              <input
                type="file"
                accept="application/pdf,image/*"
                style={{ display: 'none' }}
                onChange={(e) => void handleFileChange(e)}
              />
            </label>

            {error && <IonText color="danger"><p style={{ marginTop: 12, fontSize: 13, textAlign: 'center', fontWeight: 600 }}>{error}</p></IonText>}

            <IonButton
              expand="block"
              fill="clear"
              onClick={onClose}
              style={{ marginTop: 12, fontWeight: 600, color: '#64748b' }}
            >
              ยกเลิก
            </IonButton>
          </>
        )}

        {step === 'extracting' && (
          <div style={{ textAlign: 'center', padding: '36px 16px' }}>
            <IonSpinner style={{ width: 36, height: 36, color: '#4f46e5' }} />
            <p style={{ margin: '14px 0 4px', fontSize: 15, fontWeight: 700, color: '#0f172a' }}>
              กำลังสแกนเอกสาร {fileName}...
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--tl-text-secondary)' }}>
              AI กำลังสกัดยอดหนี้ ยอดขั้นต่ำ ดอกเบี้ย และวันครบกำหนด
            </p>
          </div>
        )}

        {step === 'password' && (
          <>
            <div style={{ textAlign: 'center', marginBottom: 18 }}>
              <div
                style={{
                  width: 52, height: 52, borderRadius: 18,
                  background: 'linear-gradient(135deg, #fff7ed 0%, #fed7aa 100%)',
                  color: '#9a3412',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: 10,
                }}
              >
                <IonIcon icon={lockClosedOutline} style={{ fontSize: 26 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>ไฟล์นี้มีรหัสผ่าน</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--tl-text-secondary)', lineHeight: 1.4 }}>
                กรอกรหัสผ่านของไฟล์ {fileName} เพื่อปลดล็อกและอ่านข้อมูล
              </p>
            </div>

            <FieldLabel>รหัสผ่านไฟล์</FieldLabel>
            <IonInput
              fill="outline"
              type="password"
              inputmode="text"
              placeholder="เช่น เลขบัตรประชาชน หรือวันเกิด"
              value={password}
              onIonInput={(e) => setPassword(e.detail.value ?? '')}
              onKeyDown={(e) => { if (e.key === 'Enter' && password) void handlePasswordSubmit(); }}
            />

            {error && <IonText color="danger"><p style={{ marginTop: 8, fontSize: 13, textAlign: 'center', fontWeight: 600 }}>{error}</p></IonText>}

            <IonButton
              expand="block"
              disabled={!password}
              onClick={() => void handlePasswordSubmit()}
              style={{
                marginTop: 14,
                '--border-radius': '999px',
                '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                fontWeight: 700,
                fontSize: 15,
                minHeight: 50,
              }}
            >
              ปลดล็อกและอ่านไฟล์
            </IonButton>

            <IonButton expand="block" fill="clear" onClick={handleReset} style={{ marginTop: 4, fontWeight: 600, color: '#64748b' }}>
              เลือกไฟล์อื่น
            </IonButton>
          </>
        )}

        {(step === 'review' || step === 'saving') && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <IonIcon icon={sparklesOutline} style={{ color: '#4f46e5', fontSize: 20 }} />
              <p style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>ตรวจสอบข้อมูลหนี้สิน</p>
            </div>

            <div className="tl-card" style={{ background: '#f8fafc', padding: 16, marginBottom: 14 }}>
              <div>
                <FieldLabel>ชื่อหนี้สิน</FieldLabel>
                <IonInput fill="outline" value={form.name} onIonInput={(e) => setForm({ ...form, name: e.detail.value ?? '' })} />
              </div>

              <div style={{ marginTop: 10 }}>
                <FieldLabel>เจ้าหนี้ / สถาบันการเงิน</FieldLabel>
                <IonInput fill="outline" value={form.creditor} onIonInput={(e) => setForm({ ...form, creditor: e.detail.value ?? '' })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <FieldLabel>ยอดคงเหลือ (บาท)</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="decimal" value={form.outstanding} onIonInput={(e) => setForm({ ...form, outstanding: e.detail.value ?? '' })} />
                </div>
                <div>
                  <FieldLabel>ขั้นต่ำ (บาท)</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="decimal" value={form.minimum} onIonInput={(e) => setForm({ ...form, minimum: e.detail.value ?? '' })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                <div>
                  <FieldLabel>ครบกำหนด</FieldLabel>
                  <DateField value={form.dueDate} onChange={(val) => setForm({ ...form, dueDate: val, recurringDueDay: val ? String(Number(val.split('-')[2])) : '' })} />
                </div>
                <div>
                  <FieldLabel>ดอกเบี้ยต่อปี (%)</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="decimal" placeholder="16.5" value={form.interestRateAnnual} onIonInput={(e) => setForm({ ...form, interestRateAnnual: e.detail.value ?? '' })} />
                </div>
              </div>
            </div>

            {error && <IonText color="danger"><p style={{ marginTop: 8, fontSize: 13, textAlign: 'center', fontWeight: 600 }}>{error}</p></IonText>}

            <IonButton
              expand="block"
              disabled={step === 'saving'}
              onClick={() => void handleSave()}
              style={{
                marginTop: 14,
                '--border-radius': '999px',
                '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                '--box-shadow': '0 8px 20px -4px rgba(15, 23, 42, 0.3)',
                fontWeight: 700,
                fontSize: 15,
                minHeight: 50,
              }}
            >
              {step === 'saving' ? <IonSpinner name="dots" /> : 'นำเข้าหนี้นี้เข้าพอร์ต'}
            </IonButton>

            <IonButton
              expand="block"
              fill="clear"
              disabled={step === 'saving'}
              onClick={handleReset}
              style={{ marginTop: 4, fontWeight: 600, color: '#64748b' }}
            >
              เลือกไฟล์อื่น
            </IonButton>
          </>
        )}

        {step === 'saved' && (
          <div style={{ textAlign: 'center', padding: '24px 16px' }}>
            <IonIcon icon={checkmarkCircleOutline} color="success" style={{ fontSize: 52, marginBottom: 12 }} />
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f172a' }}>นำเข้าหนี้สำเร็จแล้ว!</h3>
            <p style={{ margin: '6px 0 20px', fontSize: 14, color: 'var(--tl-text-secondary)' }}>
              หนี้สินของคุณถูกเพิ่มเข้าพอร์ตสำหรับวางแผนชำระเรียบร้อยแล้ว
            </p>
            <IonButton
              expand="block"
              onClick={() => { handleReset(); onClose(); }}
              style={{
                '--border-radius': '999px',
                '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                fontWeight: 700,
                fontSize: 15,
                minHeight: 48,
              }}
            >
              ดูรายการหนี้ทั้งหมด
            </IonButton>
          </div>
        )}
      </div>
    </IonModal>
  );
};

export default DebtImportModal;
