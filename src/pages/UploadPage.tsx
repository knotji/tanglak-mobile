import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonIcon,
  IonInput,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  useIonViewWillEnter,
} from '@ionic/react';
import { cameraOutline, checkmarkCircle } from 'ionicons/icons';
import { extractDocument, type ExtractedFinancialDocument } from '@/lib/documentUpload';
import { saveTransaction, type SaveTransactionInput } from '@/lib/saveTransaction';
import { addDebtPayment } from '@/lib/addDebtPayment';
import { CATEGORY_OPTIONS } from '@/lib/categories';
import { listDebts, type Debt } from '@/lib/debts';
import { nowBangkokDatetimeLocal } from '@/lib/bangkokDate';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';
import DateTimeField from '@/components/DateTimeField';

const DOCUMENT_TYPE_LABEL: Record<string, string> = {
  salary_slip: 'สลิปเงินเดือน',
  transfer_slip: 'สลิปโอนเงิน',
  receipt: 'ใบเสร็จ',
  delivery_receipt: 'ใบเสร็จเดลิเวอรี',
  debt_statement: 'ใบแจ้งหนี้',
  loan_schedule: 'ตารางผ่อนชำระ',
  other: 'เอกสารอื่น ๆ',
};

type SavableType = 'expense' | 'income' | 'transfer' | 'refund' | 'debt_payment';

interface DraftForm {
  type: SavableType;
  amount: string;
  merchant: string;
  datetimeLocal: string;
  categoryId: string;
  debtId: string;
}

function isoToDatetimeLocal(iso?: string): string {
  if (!iso) return '';
  // Bangkok is a fixed UTC+7 offset app-wide -- take the printed wall-clock
  // digits as-is rather than converting through the device's own timezone.
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : '';
}

function datetimeLocalToIso(value: string): string {
  return value ? `${value}:00+07:00` : '';
}

function draftFromExtraction(result: ExtractedFinancialDocument): DraftForm {
  const type = result.transaction?.type;
  const savableType: SavableType =
    type === 'income' || type === 'transfer' || type === 'refund' || type === 'debt_payment' ? type : 'expense';
  return {
    type: savableType,
    amount: result.transaction?.amount !== undefined ? String(result.transaction.amount) : '',
    merchant: result.transaction?.merchant ?? '',
    datetimeLocal: isoToDatetimeLocal(result.transaction?.occurredAt),
    categoryId: result.transaction?.categoryId ?? '',
    debtId: '',
  };
}

const UploadPage: React.FC = () => {
  const [step, setStep] = useState<'pick' | 'extracting' | 'review' | 'saving' | 'saved'>('pick');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [unclearFields, setUnclearFields] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);

  useIonViewWillEnter(() => {
    void listDebts().then(setDebts).catch(() => setDebts([]));
  });

  const reset = () => {
    setStep('pick');
    setPreviewUrl(null);
    setError('');
    setUnclearFields([]);
    setDraft(null);
  };

  // Ionic keeps each tab's page mounted when you switch tabs (so scroll
  // position/state survives a quick tab-away-and-back) -- without this,
  // leaving the "saved" confirmation up and coming back to this tab later
  // would still show last scan's success screen instead of a fresh picker.
  // Only the "saved" dead-end resets; an in-progress review is left alone
  // so briefly switching tabs mid-edit doesn't discard the user's draft.
  useIonViewWillEnter(() => {
    if (step === 'saved') reset();
  }, [step]);

  const handleFile = async (file: File) => {
    setError('');
    setPreviewUrl(URL.createObjectURL(file));
    setStep('extracting');
    try {
      const result = await extractDocument(file);
      setDraft(draftFromExtraction(result));
      setUnclearFields(result.unclearFields);
      setStep('review');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'อ่านสลิปไม่สำเร็จ');
      setStep('pick');
    }
  };

  const handleManualEntry = () => {
    setError('');
    setUnclearFields([]);
    setDraft({
      type: 'expense',
      amount: '',
      merchant: '',
      datetimeLocal: nowBangkokDatetimeLocal(),
      categoryId: '',
      debtId: '',
    });
    setStep('review');
  };

  const handleSave = async () => {
    if (!draft) return;
    const amountNumber = Number(draft.amount);
    if (!draft.amount || !Number.isFinite(amountNumber) || amountNumber <= 0) {
      setError('กรุณาระบุจำนวนเงินให้ถูกต้อง');
      return;
    }
    const occurredAt = datetimeLocalToIso(draft.datetimeLocal);
    if (!occurredAt) {
      setError('กรุณาระบุวันที่ทำรายการ');
      return;
    }
    if (draft.type === 'debt_payment' && !draft.debtId) {
      setError('กรุณาเลือกหนี้ที่ต้องการจ่าย');
      return;
    }
    setError('');
    setStep('saving');
    try {
      if (draft.type === 'debt_payment') {
        await addDebtPayment({ debtId: draft.debtId, amount: amountNumber, occurredAt });
      } else {
        const category = CATEGORY_OPTIONS.find((option) => option.id === draft.categoryId);
        const input: SaveTransactionInput = {
          type: draft.type,
          amount: amountNumber,
          occurredAt,
          merchant: draft.merchant || undefined,
          categoryLabel: category?.label,
        };
        await saveTransaction(input);
      }
      setStep('saved');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกรายการไม่สำเร็จ');
      setStep('review');
    }
  };

  const categoryOptionsForType = CATEGORY_OPTIONS.filter((option) =>
    draft?.type === 'income' ? option.kind === 'income' : option.kind === 'expense',
  );

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="สแกนสลิป" subtitle="ถ่ายรูปสลิปให้ AI อ่านข้อมูลให้" />

        {step === 'pick' && (
          <>
            <label className="upload-picker">
              <IonIcon icon={cameraOutline} style={{ fontSize: 32 }} />
              <p>ถ่ายรูปหรือเลือกสลิป</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void handleFile(file);
                }}
              />
            </label>
            <IonButton expand="block" fill="clear" className="ion-margin-top" onClick={handleManualEntry}>
              กรอกเองไม่ต้องสแกน
            </IonButton>
            {error && (
              <IonText color="danger">
                <p className="ion-margin-top">{error}</p>
              </IonText>
            )}
          </>
        )}

        {step === 'extracting' && (
          <div className="tl-card" style={{ textAlign: 'center', padding: 32 }}>
            {previewUrl && <img src={previewUrl} alt="" style={{ width: '100%', borderRadius: 12, marginBottom: 16 }} />}
            <IonSpinner />
            <p style={{ marginTop: 8, color: 'var(--tl-text-secondary)' }}>กำลังอ่านข้อมูลจากสลิป…</p>
          </div>
        )}

        {(step === 'review' || step === 'saving') && draft && (
          <>
            <div className="tl-card">
              <IonSegment
                value={draft.type}
                onIonChange={(e) => setDraft({ ...draft, type: e.detail.value as SavableType, categoryId: '', debtId: '' })}
              >
                <IonSegmentButton value="expense"><IonText>รายจ่าย</IonText></IonSegmentButton>
                <IonSegmentButton value="income"><IonText>รายรับ</IonText></IonSegmentButton>
                <IonSegmentButton value="transfer"><IonText>โอนเงิน</IonText></IonSegmentButton>
                <IonSegmentButton value="debt_payment"><IonText>จ่ายหนี้</IonText></IonSegmentButton>
              </IonSegment>

              <div style={{ marginTop: 18 }}>
                <FieldLabel>จำนวนเงิน (บาท)</FieldLabel>
                <IonInput
                  fill="outline"
                  type="number"
                  inputmode="decimal"
                  value={draft.amount}
                  onIonInput={(e) => setDraft({ ...draft, amount: e.detail.value ?? '' })}
                />
              </div>

              {draft.type === 'debt_payment' ? (
                <div style={{ marginTop: 14 }}>
                  <FieldLabel>หนี้ที่จะจ่าย</FieldLabel>
                  {debts.length === 0 ? (
                    <p style={{ fontSize: 13, color: 'var(--tl-text-secondary)' }}>
                      ยังไม่มีรายการหนี้ในระบบ — เพิ่มหนี้ผ่านเว็บตั้งหลักก่อน (แอปมือถือยังไม่มีหน้าเพิ่มหนี้)
                    </p>
                  ) : (
                    <IonSelect
                      fill="outline"
                      interface="action-sheet"
                      placeholder="เลือกหนี้"
                      value={draft.debtId}
                      onIonChange={(e) => setDraft({ ...draft, debtId: e.detail.value })}
                    >
                      {debts.map((debt) => (
                        <IonSelectOption key={debt.id} value={debt.id}>{debt.name}</IonSelectOption>
                      ))}
                    </IonSelect>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 14 }}>
                  <FieldLabel>ร้าน/บุคคล</FieldLabel>
                  <IonInput
                    fill="outline"
                    value={draft.merchant}
                    onIonInput={(e) => setDraft({ ...draft, merchant: e.detail.value ?? '' })}
                  />
                </div>
              )}

              <div style={{ marginTop: 14 }}>
                <DateTimeField
                  value={draft.datetimeLocal}
                  onChange={(value) => setDraft({ ...draft, datetimeLocal: value })}
                  hint={unclearFields.includes('transaction.occurredAt') ? 'AI อ่านวันที่ไม่ชัดเจน กรุณาตรวจสอบ' : undefined}
                />
              </div>

              {draft.type !== 'transfer' && draft.type !== 'debt_payment' && (
                <div style={{ marginTop: 14 }}>
                  <FieldLabel>หมวดหมู่</FieldLabel>
                  <IonSelect
                    fill="outline"
                    interface="action-sheet"
                    placeholder="เลือกหมวดหมู่"
                    value={draft.categoryId}
                    onIonChange={(e) => setDraft({ ...draft, categoryId: e.detail.value })}
                  >
                    {categoryOptionsForType.map((option) => (
                      <IonSelectOption key={option.id} value={option.id}>{option.label}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              )}
            </div>

            {error && (
              <IonText color="danger">
                <p className="ion-margin-top">{error}</p>
              </IonText>
            )}

            <IonButton expand="block" className="ion-margin-top" disabled={step === 'saving'} onClick={handleSave}>
              {step === 'saving' ? <IonSpinner name="dots" /> : 'บันทึกรายการ'}
            </IonButton>
            <IonButton expand="block" fill="clear" disabled={step === 'saving'} onClick={reset}>
              ยกเลิก
            </IonButton>
          </>
        )}

        {step === 'saved' && (
          <div className="tl-card" style={{ textAlign: 'center', padding: 32 }}>
            <IonIcon icon={checkmarkCircle} color="success" style={{ fontSize: 48 }} />
            <p style={{ fontWeight: 700, marginTop: 12 }}>บันทึกรายการแล้ว</p>
            <IonButton expand="block" className="ion-margin-top" onClick={reset}>
              สแกนสลิปอีกใบ
            </IonButton>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UploadPage;
