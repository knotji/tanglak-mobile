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
  IonSelect,
  IonSelectOption,
  IonSpinner,
  IonText,
  IonTextarea,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';
import { getDebtById, createDebt, updateDebt, deleteDebt, type DebtFormInput } from '@/lib/debts';

const EMPTY: DebtFormInput = {
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

const PAYMENT_MODE_LABEL: Record<NonNullable<DebtFormInput['paymentMode']>, string> = {
  variable_monthly: 'ยอดเปลี่ยนรายเดือน',
  fixed_monthly: 'ยอดคงที่รายเดือน',
  installment: 'ผ่อนเป็นงวด',
  one_time: 'จ่ายครั้งเดียว',
};

const DebtFormPage: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const isEdit = Boolean(id);
  const history = useHistory();
  const [form, setForm] = useState<DebtFormInput>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useIonViewWillEnter(() => {
    if (!id) {
      setForm(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    void getDebtById(id)
      .then((debt) => {
        if (!debt) {
          setNotFound(true);
          return;
        }
        setForm({
          name: debt.name,
          creditor: debt.creditor ?? '',
          outstanding: debt.outstandingBalanceSatang !== null ? String(debt.outstandingBalanceSatang / 100) : '',
          amountDue: debt.amountDueSatang !== null ? String(debt.amountDueSatang / 100) : '',
          minimum: debt.minimumPaymentSatang !== null ? String(debt.minimumPaymentSatang / 100) : '',
          dueDate: debt.dueDate ?? '',
          recurringDueDay: debt.recurringDueDay !== null ? String(debt.recurringDueDay) : '',
          paymentMode: debt.paymentMode,
          interestRateAnnual: debt.interestRateAnnual !== null ? String(debt.interestRateAnnual) : '',
          notes: debt.notes ?? '',
        });
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลหนี้ไม่สำเร็จ'))
      .finally(() => setLoading(false));
  });

  const handleSave = async () => {
    setError('');
    setBusy(true);
    try {
      if (isEdit && id) await updateDebt(id, form);
      else await createDebt(form);
      history.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'บันทึกหนี้ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    setBusy(true);
    try {
      await deleteDebt(id);
      history.goBack();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'ลบหนี้ไม่สำเร็จ');
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <IonPage>
      <IonHeader className="ion-no-border">
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/tabs/debts" text="" />
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title={isEdit ? 'แก้ไขหนี้' : 'เพิ่มหนี้'} />

        {loading && <div className="ion-text-center ion-margin-top"><IonSpinner /></div>}

        {notFound && (
          <div className="tl-card tl-empty"><p>ไม่พบหนี้นี้</p></div>
        )}

        {!loading && !notFound && (
          <>
            <div className="tl-card">
              <FieldLabel>ชื่อหนี้</FieldLabel>
              <IonInput fill="outline" value={form.name} onIonInput={(e) => setForm({ ...form, name: e.detail.value ?? '' })} />

              <div style={{ marginTop: 14 }}>
                <FieldLabel>เจ้าหนี้</FieldLabel>
                <IonInput fill="outline" value={form.creditor} onIonInput={(e) => setForm({ ...form, creditor: e.detail.value ?? '' })} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <div>
                  <FieldLabel>ยอดคงเหลือ (บาท)</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="decimal" value={form.outstanding} onIonInput={(e) => setForm({ ...form, outstanding: e.detail.value ?? '' })} />
                </div>
                <div>
                  <FieldLabel>ยอดเดือนนี้ (บาท)</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="decimal" value={form.amountDue} onIonInput={(e) => setForm({ ...form, amountDue: e.detail.value ?? '' })} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <div>
                  <FieldLabel>ขั้นต่ำ (บาท)</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="decimal" value={form.minimum} onIonInput={(e) => setForm({ ...form, minimum: e.detail.value ?? '' })} />
                </div>
                <div>
                  <FieldLabel>ครบกำหนด</FieldLabel>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--tl-border)', fontFamily: 'inherit', fontSize: 16 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 14 }}>
                <div>
                  <FieldLabel>วันครบกำหนดซ้ำ</FieldLabel>
                  <IonInput fill="outline" type="number" inputmode="numeric" placeholder="18" value={form.recurringDueDay} onIonInput={(e) => setForm({ ...form, recurringDueDay: e.detail.value ?? '' })} />
                </div>
                <div>
                  <FieldLabel>รูปแบบจ่าย</FieldLabel>
                  <IonSelect
                    fill="outline"
                    interface="action-sheet"
                    value={form.paymentMode}
                    onIonChange={(e) => setForm({ ...form, paymentMode: e.detail.value })}
                  >
                    {(Object.keys(PAYMENT_MODE_LABEL) as Array<NonNullable<DebtFormInput['paymentMode']>>).map((mode) => (
                      <IonSelectOption key={mode} value={mode}>{PAYMENT_MODE_LABEL[mode]}</IonSelectOption>
                    ))}
                  </IonSelect>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <FieldLabel>อัตราดอกเบี้ยต่อปี (%)</FieldLabel>
                <IonInput fill="outline" type="number" inputmode="decimal" placeholder="16.5" value={form.interestRateAnnual} onIonInput={(e) => setForm({ ...form, interestRateAnnual: e.detail.value ?? '' })} />
                <p style={{ fontSize: 12, marginTop: 4, color: 'var(--tl-text-secondary)' }}>ไม่บังคับ เว้นว่างได้ถ้าไม่มีดอกเบี้ย (0-100%)</p>
              </div>

              <div style={{ marginTop: 14 }}>
                <FieldLabel>โน้ต</FieldLabel>
                <IonTextarea fill="outline" autoGrow value={form.notes} onIonInput={(e) => setForm({ ...form, notes: e.detail.value ?? '' })} />
              </div>
            </div>

            {error && (
              <IonText color="danger"><p className="ion-margin-top">{error}</p></IonText>
            )}

            <IonButton expand="block" className="ion-margin-top" disabled={busy} onClick={() => void handleSave()}>
              {busy ? <IonSpinner name="dots" /> : 'บันทึกหนี้'}
            </IonButton>
            {isEdit && (
              <IonButton expand="block" fill="clear" color="danger" disabled={busy} onClick={() => setConfirmDelete(true)}>
                ลบหนี้นี้
              </IonButton>
            )}
          </>
        )}

        <IonAlert
          isOpen={confirmDelete}
          header="ลบหนี้นี้?"
          message="รายการจ่ายหนี้ที่บันทึกไว้ก่อนหน้าจะยังอยู่ แต่หนี้นี้จะไม่แสดงในรายการอีก"
          buttons={[
            { text: 'ยกเลิก', role: 'cancel', handler: () => setConfirmDelete(false) },
            { text: 'ลบ', role: 'destructive', handler: () => { void handleDelete(); } },
          ]}
        />
      </IonContent>
    </IonPage>
  );
};

export default DebtFormPage;
