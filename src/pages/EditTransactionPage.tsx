import { useState } from 'react';
import { useParams, useHistory } from 'react-router-dom';
import {
  IonAlert,
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
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
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';
import DateTimeField from '@/components/DateTimeField';
import { CATEGORY_OPTIONS } from '@/lib/categories';
import { getTransactionById } from '@/lib/transactions';
import { saveTransaction, deleteTransaction, type SaveTransactionInput } from '@/lib/saveTransaction';

type EditableType = 'expense' | 'income' | 'transfer' | 'refund';

interface DraftForm {
  type: EditableType;
  amount: string;
  merchant: string;
  datetimeLocal: string;
  categoryId: string;
}

function isoToDatetimeLocal(iso: string): string {
  const match = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/);
  return match ? `${match[1]}T${match[2]}` : '';
}

function datetimeLocalToIso(value: string): string {
  return value ? `${value}:00+07:00` : '';
}

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
          datetimeLocal: isoToDatetimeLocal(transaction.occurredAt),
          categoryId: CATEGORY_OPTIONS.find((option) => option.label === transaction.categoryLabel)?.id ?? '',
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
        <PageHeader title="แก้ไขรายการ" />

        {!draft && !notFound && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {notFound && (
          <div className="tl-card tl-empty">
            <p>ไม่พบรายการนี้ หรือเป็นรายการจ่ายหนี้ซึ่งยังแก้ไขไม่ได้ — ลบแล้วบันทึกใหม่แทน</p>
          </div>
        )}

        {draft && (
          <>
            <div className="tl-card">
              <IonSegment value={draft.type} onIonChange={(e) => setDraft({ ...draft, type: e.detail.value as EditableType, categoryId: '' })}>
                <IonSegmentButton value="expense"><IonText>รายจ่าย</IonText></IonSegmentButton>
                <IonSegmentButton value="income"><IonText>รายรับ</IonText></IonSegmentButton>
                <IonSegmentButton value="transfer"><IonText>โอนเงิน</IonText></IonSegmentButton>
                <IonSegmentButton value="refund"><IonText>เงินคืน</IonText></IonSegmentButton>
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
                <DateTimeField value={draft.datetimeLocal} onChange={(value) => setDraft({ ...draft, datetimeLocal: value })} />
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
            </div>

            {error && (
              <IonText color="danger">
                <p className="ion-margin-top">{error}</p>
              </IonText>
            )}

            <IonButton expand="block" className="ion-margin-top" disabled={busy} onClick={handleSave}>
              {busy ? <IonSpinner name="dots" /> : 'บันทึกการแก้ไข'}
            </IonButton>
            <IonButton expand="block" fill="clear" color="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
              ลบรายการนี้
            </IonButton>
          </>
        )}

        <IonAlert
          isOpen={confirmDelete}
          header="ลบรายการนี้?"
          message="ลบแล้วกู้คืนไม่ได้"
          buttons={[
            { text: 'ยกเลิก', role: 'cancel', handler: () => setConfirmDelete(false) },
            { text: 'ลบ', role: 'destructive', handler: () => { void handleDelete(); } },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default EditTransactionPage;
