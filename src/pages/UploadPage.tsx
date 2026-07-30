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
import { cameraOutline, checkmarkCircle, imagesOutline, warningOutline, sparklesOutline } from 'ionicons/icons';
import { extractDocument, type ExtractedFinancialDocument } from '@/lib/documentUpload';
import { saveTransaction, type SaveTransactionInput } from '@/lib/saveTransaction';
import { CATEGORY_OPTIONS } from '@/lib/categories';
import { nowBangkokDatetimeLocal } from '@/lib/bangkokDate';
import { isoInstantToBangkokDatetimeLocal } from '@/lib/date';
import { checkDuplicateTransaction } from '@/lib/transactions';
import { findCategoryForMerchant, learnMerchantCategoryRule } from '@/lib/merchantRules';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';
import DateTimeField from '@/components/DateTimeField';

type SavableType = 'expense' | 'income' | 'transfer' | 'refund';

interface DraftForm {
  type: SavableType;
  amount: string;
  merchant: string;
  datetimeLocal: string;
  categoryId: string;
  source: 'manual' | 'ai_extraction';
  isDuplicate?: boolean;
  refNo?: string;
  bankChannel?: string;
  senderName?: string;
  receiverName?: string;
  memo?: string;
}

/** One slip queued up for review -- built once, right after extraction, and never mutated in place; the currently-edited copy lives in `draft` while its index is active. */
interface QueueEntry {
  previewUrl?: string;
  draft: DraftForm;
  unclearFields: string[];
}

function datetimeLocalToIso(value: string): string {
  return value ? `${value}:00+07:00` : '';
}

function draftFromExtraction(result: ExtractedFinancialDocument): DraftForm {
  const type = result.transaction?.type;
  const savableType: SavableType =
    type === 'income' || type === 'transfer' || type === 'refund' ? type : 'expense';
  const merchant = result.transaction?.merchant ?? '';
  let categoryId = type === 'debt_payment' ? 'debt' : (result.transaction?.categoryId ?? '');
  if ((!categoryId || categoryId === 'other') && merchant) {
    const matched = findCategoryForMerchant(merchant);
    if (matched) categoryId = matched;
  }
  return {
    type: savableType,
    amount: result.transaction?.amount !== undefined ? String(result.transaction.amount) : '',
    merchant,
    datetimeLocal: result.transaction?.occurredAt ? isoInstantToBangkokDatetimeLocal(result.transaction.occurredAt) : '',
    categoryId,
    source: 'ai_extraction',
    refNo: result.transaction?.refNo,
    bankChannel: result.transaction?.bankChannel ?? result.transaction?.paymentMethod,
    senderName: result.transaction?.senderName,
    receiverName: result.transaction?.receiverName,
    memo: result.transaction?.memo,
  };
}

function emptyDraft(): DraftForm {
  return {
    type: 'expense',
    amount: '',
    merchant: '',
    datetimeLocal: nowBangkokDatetimeLocal(),
    categoryId: '',
    source: 'manual',
  };
}

const UploadPage: React.FC = () => {
  const [step, setStep] = useState<'pick' | 'extracting' | 'review' | 'saving' | 'saved'>('pick');
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [extractProgress, setExtractProgress] = useState({ done: 0, total: 0 });
  const [savedCount, setSavedCount] = useState(0);
  const [notSavedCount, setNotSavedCount] = useState(0);
  const [skippedDuplicateCount, setSkippedDuplicateCount] = useState(0);
  const [saveErrorMessages, setSaveErrorMessages] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [unclearFields, setUnclearFields] = useState<string[]>([]);
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const reset = () => {
    for (const entry of queue) {
      if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    }
    setStep('pick');
    setQueue([]);
    setQueueIndex(0);
    setExtractProgress({ done: 0, total: 0 });
    setSavedCount(0);
    setNotSavedCount(0);
    setSkippedDuplicateCount(0);
    setSaveErrorMessages([]);
    setPreviewUrl(null);
    setError('');
    setUnclearFields([]);
    setDraft(null);
  };

  useIonViewWillEnter(() => {
    if (step === 'saved') reset();
  }, [step]);

  const enterQueueItem = (index: number, nextQueue: QueueEntry[] = queue) => {
    const entry = nextQueue[index];
    setQueueIndex(index);
    setDraft(entry.draft);
    setUnclearFields(entry.unclearFields);
    setPreviewUrl(entry.previewUrl ?? null);
    setError('');
    setStep('review');
  };

  const advanceQueue = () => {
    const next = queueIndex + 1;
    if (next < queue.length) {
      enterQueueItem(next);
    } else {
      setStep('saved');
    }
  };

  type SaveEntryResult = { kind: 'saved' | 'duplicate' | 'incomplete' } | { kind: 'error'; message: string };

  /**
   * Shared by both the batch-save loop (saveEntry below) and the single-item
   * interactive review screen (handleSave below) -- previously each hand-rolled
   * its own copy of this validate/dedupe/save logic, and only the batch path
   * called learnMerchantCategoryRule afterward. That meant merchant-category
   * learning silently only happened for batch uploads, never for a manually
   * entered or single-photo transaction saved through the review form -- an
   * accidental behavioral difference between two paths a user can't tell apart.
   */
  const saveDraftEntry = async (entryDraft: DraftForm): Promise<SaveEntryResult> => {
    const amountNumber = Number(entryDraft.amount);
    if (!entryDraft.amount || !Number.isFinite(amountNumber) || amountNumber <= 0) return { kind: 'incomplete' };
    const occurredAt = datetimeLocalToIso(entryDraft.datetimeLocal);
    if (!occurredAt) return { kind: 'incomplete' };

    const amountSatang = Math.round(amountNumber * 100);
    if (!entryDraft.isDuplicate) {
      try {
        const existing = await checkDuplicateTransaction({ amountSatang, occurredAt });
        if (existing) {
          return { kind: 'duplicate' };
        }
      } catch (cause) {
        // Don't silently treat "couldn't check for a duplicate" as "no duplicate" --
        // that would disable the app's only anti-double-save guard exactly when the
        // network is flaky, which is also when a retry-tap is most likely.
        return { kind: 'error', message: cause instanceof Error ? cause.message : 'ตรวจสอบรายการซ้ำไม่สำเร็จ' };
      }
    }

    try {
      const category = CATEGORY_OPTIONS.find((option) => option.id === entryDraft.categoryId);
      const input: SaveTransactionInput = {
        type: entryDraft.type,
        amount: amountNumber,
        occurredAt,
        merchant: entryDraft.merchant || undefined,
        categoryLabel: category?.label,
        source: entryDraft.source,
      };
      await saveTransaction(input);
      if (entryDraft.merchant && entryDraft.categoryId) {
        learnMerchantCategoryRule(entryDraft.merchant, entryDraft.categoryId);
      }
      return { kind: 'saved' };
    } catch (cause) {
      return { kind: 'error', message: cause instanceof Error ? cause.message : 'บันทึกรายการไม่สำเร็จ' };
    }
  };

  const handleFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setError('');
    setStep('extracting');
    setExtractProgress({ done: 0, total: files.length });

    const entries: QueueEntry[] = [];
    let failCount = 0;
    for (let i = 0; i < files.length; i++) {
      const url = URL.createObjectURL(files[i]);
      try {
        const result = await extractDocument(files[i]);
        const d = draftFromExtraction(result);
        entries.push({ previewUrl: url, draft: d, unclearFields: result.unclearFields });
      } catch {
        failCount += 1;
        URL.revokeObjectURL(url);
      }
      setExtractProgress({ done: i + 1, total: files.length });
    }

    if (entries.length === 0) {
      setError(files.length > 1 ? 'อ่านสลิปทั้งหมดไม่สำเร็จ' : 'อ่านสลิปไม่สำเร็จ');
      setStep('pick');
      return;
    }

    setNotSavedCount(failCount);
    setQueue(entries);
    enterQueueItem(0, entries);
  };

  const handleManualEntry = () => {
    const entry: QueueEntry = { draft: emptyDraft(), unclearFields: [] };
    setQueue([entry]);
    enterQueueItem(0, [entry]);
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
    setError('');
    setStep('saving');
    const result = await saveDraftEntry(draft);
    if (result.kind === 'saved') {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setSavedCount((count) => count + 1);
      advanceQueue();
    } else if (result.kind === 'duplicate') {
      // Pre-validation above already confirmed amount/date are
      // present, so the only way saveDraftEntry itself declines is a real
      // duplicate or error -- surface the duplicate as an inline warning
      // rather than silently refusing to let the user override it.
      setDraft({ ...draft, isDuplicate: true });
      setStep('review');
    } else {
      // 'incomplete' can't actually happen here (validated above), but
      // TypeScript doesn't know that -- treat it the same as 'error'.
      setError(result.kind === 'error' ? result.message : 'บันทึกรายการไม่สำเร็จ');
      setStep('review');
    }
  };

  const handleSkip = () => {
    if (draft?.isDuplicate) setSkippedDuplicateCount((count) => count + 1);
    else setNotSavedCount((count) => count + 1);
    advanceQueue();
  };

  const categoryOptionsForType = CATEGORY_OPTIONS.filter((option) =>
    draft?.type === 'income' ? option.kind === 'income' : option.kind === 'expense',
  );

  const isBatch = queue.length > 1;

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="สแกนสลิป" subtitle="ให้ AI อ่านข้อมูล แล้วตรวจสอบก่อนบันทึกทุกครั้ง" />

        {step === 'pick' && (
          <>
            <label className="upload-picker">
              <IonIcon icon={cameraOutline} style={{ fontSize: 32 }} />
              <p>ถ่ายรูปสลิป</p>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) void handleFiles([file]);
                }}
              />
            </label>
            <label className="upload-picker" style={{ marginTop: 12 }}>
              <IonIcon icon={imagesOutline} style={{ fontSize: 32 }} />
              <p>เลือกหลายรูปจากคลังภาพ</p>
              <input
                type="file"
                accept="image/*"
                multiple
                style={{ display: 'none' }}
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  event.target.value = '';
                  if (files.length) void handleFiles(files);
                }}
              />
            </label>
            <div style={{ paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
              <IonButton expand="block" fill="clear" className="ion-margin-top" onClick={handleManualEntry}>
                กรอกเองไม่ต้องสแกน
              </IonButton>
              {error && (
                <IonText color="danger">
                  <p className="ion-margin-top">{error}</p>
                </IonText>
              )}
            </div>
          </>
        )}

        {step === 'extracting' && (
          <div className="tl-card" style={{ textAlign: 'center', padding: 32 }}>
            <IonSpinner />
            <p style={{ marginTop: 8, color: 'var(--tl-text-secondary)' }}>
              กำลังอ่านข้อมูลจากสลิป…
              {extractProgress.total > 1 && ` (${Math.min(extractProgress.done + 1, extractProgress.total)}/${extractProgress.total})`}
            </p>
          </div>
        )}

        {(step === 'review' || step === 'saving') && draft && (
          <>
            {draft.isDuplicate && (
              <div
                style={{
                  background: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: 16,
                  padding: '12px 16px',
                  marginBottom: 14,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  color: '#e11d48',
                }}
              >
                <IonIcon icon={warningOutline} style={{ fontSize: 22, flexShrink: 0 }} />
                <div>
                  <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>⚠️ ตรวจพบสลิปนี้ในระบบแล้ว</p>
                  <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9f1239' }}>
                    พบรายการยอดเงินตรงกันในช่วงเวลานี้ในฐานข้อมูลแล้ว
                  </p>
                </div>
              </div>
            )}

            <div className="tl-card">
              {isBatch && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                  {previewUrl && (
                    <img src={previewUrl} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />
                  )}
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--tl-text-secondary)' }}>
                    รายการที่ {queueIndex + 1} จาก {queue.length}
                  </span>
                </div>
              )}

              <IonSegment
                value={draft.type}
                onIonChange={(e) => setDraft({ ...draft, type: e.detail.value as SavableType, categoryId: '' })}
              >
                <IonSegmentButton value="expense"><IonText>รายจ่าย</IonText></IonSegmentButton>
                <IonSegmentButton value="income"><IonText>รายรับ</IonText></IonSegmentButton>
                <IonSegmentButton value="transfer"><IonText>โอนเงิน</IonText></IonSegmentButton>
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

              <div style={{ marginTop: 14 }}>
                <FieldLabel>ร้าน/บุคคล</FieldLabel>
                <IonInput
                  fill="outline"
                  value={draft.merchant}
                  onIonInput={(e) => setDraft({ ...draft, merchant: e.detail.value ?? '' })}
                />
              </div>
              <div style={{ marginTop: 14 }}>
                <DateTimeField
                  value={draft.datetimeLocal}
                  onChange={(value) => setDraft({ ...draft, datetimeLocal: value })}
                  hint={unclearFields.includes('transaction.occurredAt') ? 'AI อ่านวันที่ไม่ชัดเจน กรุณาตรวจสอบ' : undefined}
                />
              </div>

              {draft.type !== 'transfer' && (
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

              {/* Enriched AI Extraction Details */}
              {(draft.bankChannel || draft.refNo || draft.senderName || draft.receiverName || draft.memo) && (
                <div
                  style={{
                    marginTop: 18,
                    padding: '12px 14px',
                    borderRadius: 14,
                    background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, color: '#475569' }}>
                    <IonIcon icon={sparklesOutline} style={{ fontSize: 15, color: '#6366f1' }} />
                    <span style={{ fontSize: 12, fontWeight: 700 }}>รายละเอียดสกัดโดย AI</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {draft.bankChannel && (
                      <span style={{ fontSize: 11.5, background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: 999, fontWeight: 600 }}>
                        🏦 {draft.bankChannel}
                      </span>
                    )}
                    {draft.refNo && (
                      <span style={{ fontSize: 11.5, background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: 999, fontWeight: 600 }}>
                        🔢 {draft.refNo}
                      </span>
                    )}
                    {draft.senderName && (
                      <span style={{ fontSize: 11.5, background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: 999, fontWeight: 600 }}>
                        👤 {draft.senderName}
                      </span>
                    )}
                    {draft.receiverName && (
                      <span style={{ fontSize: 11.5, background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: 999, fontWeight: 600 }}>
                        📥 {draft.receiverName}
                      </span>
                    )}
                    {draft.memo && (
                      <span style={{ fontSize: 11.5, background: '#ffffff', border: '1px solid #cbd5e1', padding: '3px 8px', borderRadius: 999, fontWeight: 600 }}>
                        📝 {draft.memo}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <IonText color="danger">
                <p className="ion-margin-top">{error}</p>
              </IonText>
            )}

            <div style={{ marginTop: 24, paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
              <IonButton
                expand="block"
                disabled={step === 'saving'}
                onClick={handleSave}
                style={{
                  '--border-radius': '999px',
                  '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                  '--box-shadow': '0 8px 20px -4px rgba(15, 23, 42, 0.3)',
                  fontWeight: 700,
                  fontSize: 15,
                  minHeight: 50,
                }}
              >
                {step === 'saving'
                  ? <IonSpinner name="dots" />
                  : draft.isDuplicate
                    ? 'ยืนยันบันทึกรายการซ้ำ'
                    : isBatch && queueIndex < queue.length - 1
                      ? 'บันทึกแล้วไปต่อ'
                      : 'บันทึกรายการ'}
              </IonButton>
              {isBatch && (
                <IonButton
                  expand="block"
                  fill="outline"
                  disabled={step === 'saving'}
                  onClick={handleSkip}
                  style={{
                    '--border-radius': '999px',
                    '--border-color': '#cbd5e1',
                    '--color': '#0f172a',
                    fontWeight: 700,
                    fontSize: 14,
                    minHeight: 46,
                    marginTop: 10,
                  }}
                >
                  ข้ามรายการนี้
                </IonButton>
              )}
              <IonButton expand="block" fill="clear" disabled={step === 'saving'} onClick={reset} style={{ fontWeight: 600, marginTop: 4 }}>
                {isBatch ? 'ยกเลิกทั้งหมด' : 'ยกเลิก'}
              </IonButton>
            </div>
          </>
        )}

        {step === 'saved' && (
          <div style={{ paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
            <div className="tl-card" style={{ textAlign: 'center', padding: 32 }}>
              <IonIcon icon={checkmarkCircle} color="success" style={{ fontSize: 48 }} />
              <p style={{ fontWeight: 700, marginTop: 12 }}>
                {savedCount > 1 || notSavedCount > 0 || skippedDuplicateCount > 0
                  ? `บันทึกแล้ว ${savedCount} รายการ${skippedDuplicateCount > 0 ? ` · ข้ามสลิปซ้ำ ${skippedDuplicateCount} รายการ` : ''}${notSavedCount > 0 ? ` · ไม่ได้บันทึก ${notSavedCount} รายการ` : ''}`
                  : 'บันทึกรายการแล้ว'}
              </p>
              {saveErrorMessages.length > 0 && (
                <IonText color="danger">
                  <p style={{ fontSize: 12.5, marginTop: 6 }}>
                    {saveErrorMessages.join(' · ')}
                  </p>
                </IonText>
              )}
              <IonButton
                expand="block"
                className="ion-margin-top"
                onClick={reset}
                style={{
                  '--border-radius': '999px',
                  '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                  '--box-shadow': '0 8px 20px -4px rgba(15, 23, 42, 0.3)',
                  fontWeight: 700,
                  fontSize: 15,
                  minHeight: 50,
                }}
              >
                สแกนสลิปอีก
              </IonButton>
            </div>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default UploadPage;
