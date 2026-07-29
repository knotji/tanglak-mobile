import { useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonInput,
  IonPage,
  IonSegment,
  IonSegmentButton,
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { checkmarkCircleOutline, pricetagOutline, storefrontOutline, trashOutline, walletOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import DateTimeField from '@/components/DateTimeField';
import { CATEGORY_OPTIONS } from '@/lib/categories';
import { getTransactionById } from '@/lib/transactions';
import { saveTransaction, deleteTransaction, type SaveTransactionInput } from '@/lib/saveTransaction';
import { isoInstantToBangkokDatetimeLocal } from '@/lib/date';

type EditableType = 'expense' | 'income' | 'transfer' | 'refund';

interface DraftForm {
  type: EditableType;
  amount: string;
  merchant: string;
  datetimeLocal: string;
  categoryId: string;
  note: string;
}

function datetimeLocalToIso(value: string): string {
  return value ? `${value}:00+07:00` : '';
}

const TYPE_THEME: Record<EditableType, { color: string; label: string; badgeBg: string }> = {
  expense: { color: '#ef4444', label: 'รายจ่าย', badgeBg: 'rgba(239, 68, 68, 0.1)' },
  income: { color: '#10b981', label: 'รายรับ', badgeBg: 'rgba(16, 185, 129, 0.1)' },
  transfer: { color: '#4f46e5', label: 'โอนเงิน', badgeBg: 'rgba(79, 70, 229, 0.1)' },
  refund: { color: '#059669', label: 'เงินคืน', badgeBg: 'rgba(5, 150, 105, 0.1)' },
};

const EditTransactionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const [draft, setDraft] = useState<DraftForm | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useIonViewWillEnter(() => {
    setDraft(null);
    setNotFound(false);
    setError('');
    void getTransactionById(id)
      .then((transaction) => {
        if (!transaction || transaction.type === 'debt_payment') {
          setNotFound(true);
          return;
        }
        setDraft({
          type: transaction.type,
          amount: String(transaction.amountSatang / 100),
          merchant: transaction.merchant ?? '',
          datetimeLocal: isoInstantToBangkokDatetimeLocal(transaction.occurredAt),
          categoryId: CATEGORY_OPTIONS.find((option) => option.label === transaction.categoryLabel)?.id ?? '',
          note: transaction.note ?? '',
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดรายการไม่สำเร็จ'));
  });

  const categoryOptionsForType = CATEGORY_OPTIONS.filter((option) =>
    draft?.type === 'income' ? option.kind === 'income' : option.kind === 'expense',
  );

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
    setBusy(true);
    try {
      const category = CATEGORY_OPTIONS.find((option) => option.id === draft.categoryId);
      const input: SaveTransactionInput = {
        id,
        type: draft.type,
        amount: amountNumber,
        occurredAt,
        merchant: draft.merchant || undefined,
        categoryLabel: category?.label,
        note: draft.note || undefined,
      };
      await saveTransaction(input);
      history.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกรายการไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await deleteTransaction(id);
      history.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบรายการไม่สำเร็จ');
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/transactions" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="แก้ไขรายการ" subtitle="ปรับเปลี่ยนรายละเอียดและยอดเงิน" />

        {!draft && !notFound && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {notFound && (
          <div className="tl-card tl-empty">
            <p style={{ margin: 0, fontWeight: 600 }}>ไม่พบรายการนี้ หรือเป็นรายการเก่าที่แก้ไขไม่ได้</p>
          </div>
        )}

        {draft && (
          <div style={{ maxWidth: 440, margin: '0 auto' }}>
            {/* Type Selector Segment */}
            <div style={{ marginBottom: 16 }}>
              <IonSegment value={draft.type} onIonChange={(e) => setDraft({ ...draft, type: e.detail.value as EditableType, categoryId: '' })}>
                <IonSegmentButton value="expense"><IonText>รายจ่าย</IonText></IonSegmentButton>
                <IonSegmentButton value="income"><IonText>รายรับ</IonText></IonSegmentButton>
                <IonSegmentButton value="transfer"><IonText>โอนเงิน</IonText></IonSegmentButton>
                <IonSegmentButton value="refund"><IonText>เงินคืน</IonText></IonSegmentButton>
              </IonSegment>
            </div>

            {/* Frameless Hero Amount Display Card */}
            <div
              className="tl-card"
              style={{
                padding: '24px 20px',
                textAlign: 'center',
                marginBottom: 16,
                background: '#ffffff',
                border: '1px solid var(--tl-border)',
                borderRadius: 20,
                boxShadow: '0 8px 30px rgba(15, 23, 42, 0.05)',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: TYPE_THEME[draft.type].badgeBg,
                  color: TYPE_THEME[draft.type].color,
                  fontSize: 12.5,
                  fontWeight: 700,
                  marginBottom: 10,
                }}
              >
                <IonIcon icon={walletOutline} style={{ fontSize: 14 }} />
                <span>ยอดเงิน{TYPE_THEME[draft.type].label}</span>
              </span>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: TYPE_THEME[draft.type].color, fontVariantNumeric: 'tabular-nums' }}>฿</span>
                <IonInput
                  type="number"
                  inputmode="decimal"
                  placeholder="0"
                  value={draft.amount}
                  onIonInput={(e) => setDraft({ ...draft, amount: e.detail.value ?? '' })}
                  style={{
                    fontSize: 38,
                    fontWeight: 800,
                    width: draft.amount ? `${Math.max(2, draft.amount.length) * 24}px` : '44px',
                    maxWidth: 220,
                    color: TYPE_THEME[draft.type].color,
                    '--background': 'transparent',
                    '--padding-start': '0',
                    '--padding-end': '0',
                    '--border-width': '0',
                    '--highlight-color-focused': 'transparent',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                />
              </div>
            </div>

            {/* iOS Inset Grouped List Form Container */}
            <div
              className="tl-card"
              style={{
                padding: '0 16px',
                borderRadius: 20,
                background: '#ffffff',
                border: '1px solid var(--tl-border)',
                boxShadow: '0 4px 20px rgba(15, 23, 42, 0.03)',
              }}
            >
              {/* Merchant / Store */}
              <div style={{ padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div className="tl-icon-badge tl-icon-badge--expense" style={{ width: 34, height: 34, fontSize: 16 }}>
                    <IonIcon icon={storefrontOutline} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>ร้านค้า / ผู้รับเงิน</span>
                </div>
                <div style={{ paddingLeft: 44 }}>
                  <IonInput
                    placeholder="เช่น เซเว่น, ร้านค้า, เพื่อน"
                    value={draft.merchant}
                    onIonInput={(e) => setDraft({ ...draft, merchant: e.detail.value ?? '' })}
                    style={{
                      '--background': 'transparent',
                      '--padding-start': '0',
                      '--padding-end': '0',
                      '--border-width': '0',
                      fontSize: 15,
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>

              {/* Date & Time */}
              <div style={{ padding: '14px 0', borderBottom: draft.type !== 'transfer' ? '1px solid #f1f5f9' : 'none' }}>
                <DateTimeField value={draft.datetimeLocal} onChange={(value) => setDraft({ ...draft, datetimeLocal: value })} />
              </div>

              {/* Category */}
              {draft.type !== 'transfer' && (
                <div style={{ padding: '14px 0', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                    <div className="tl-icon-badge tl-icon-badge--transfer" style={{ width: 34, height: 34, fontSize: 16 }}>
                      <IonIcon icon={pricetagOutline} />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>หมวดหมู่</span>
                  </div>
                  <div style={{ paddingLeft: 44 }}>
                    <IonSelect
                      interface="action-sheet"
                      placeholder="เลือกหมวดหมู่"
                      value={draft.categoryId}
                      onIonChange={(e) => setDraft({ ...draft, categoryId: e.detail.value })}
                      style={{
                        '--background': 'transparent',
                        '--padding-start': '0',
                        '--padding-end': '0',
                        fontSize: 15,
                        fontWeight: 600,
                      }}
                    >
                      {categoryOptionsForType.map((option) => (
                        <IonSelectOption key={option.id} value={option.id}>{option.label}</IonSelectOption>
                      ))}
                    </IonSelect>
                  </div>
                </div>
              )}

              {/* Tag / Note */}
              <div style={{ padding: '14px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <div className="tl-icon-badge tl-icon-badge--income" style={{ width: 34, height: 34, fontSize: 16 }}>
                    <IonIcon icon={pricetagOutline} />
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#334155' }}>แท็ก / โน้ตกำกับ</span>
                </div>
                <div style={{ paddingLeft: 44 }}>
                  <IonInput
                    placeholder="เช่น #เที่ยวญี่ปุ่น, #จัดเลี้ยง"
                    value={draft.note}
                    onIonInput={(e) => setDraft({ ...draft, note: e.detail.value ?? '' })}
                    style={{
                      '--background': 'transparent',
                      '--padding-start': '0',
                      '--padding-end': '0',
                      '--border-width': '0',
                      fontSize: 14.5,
                      fontWeight: 600,
                    }}
                  />
                </div>
              </div>
            </div>

            {error && (
              <IonText color="danger">
                <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, textAlign: 'center' }}>{error}</p>
              </IonText>
            )}

            {/* Actions Footer */}
            <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))' }}>
              <IonButton
                expand="block"
                disabled={busy}
                onClick={handleSave}
                style={{
                  '--border-radius': '999px',
                  '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
                  '--box-shadow': '0 10px 25px -5px rgba(15, 23, 42, 0.3)',
                  fontWeight: 700,
                  fontSize: 15,
                  minHeight: 52,
                }}
              >
                {busy ? (
                  <IonSpinner name="dots" />
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <IonIcon icon={checkmarkCircleOutline} style={{ fontSize: 20 }} />
                    <span>บันทึกการแก้ไข</span>
                  </div>
                )}
              </IonButton>

              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <IonIcon icon={trashOutline} style={{ fontSize: 16 }} />
                <span>ลบรายการนี้</span>
              </button>
            </div>
          </div>
        )}

        <IonAlert
          isOpen={confirmDelete}
          header="ลบรายการนี้?"
          message="ลบแล้วกู้คืนไม่ได้ ยืนยันการลบรายการนี้ใช่หรือไม่"
          buttons={[
            { text: 'ยกเลิก', role: 'cancel', handler: () => setConfirmDelete(false) },
            { text: 'ลบรายการ', role: 'destructive', handler: () => { void handleDelete(); } },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default EditTransactionPage;
