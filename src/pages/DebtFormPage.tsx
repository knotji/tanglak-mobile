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
  IonToast,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import FieldLabel from '@/components/FieldLabel';
import DateField from '@/components/DateField';
import { formatThaiDateLabel } from '@/lib/date';
import {
  getDebtById,
  createDebt,
  updateDebt,
  deleteDebt,
  advanceDebtCycle,
  previewCycleAdvance,
  type Debt,
  type DebtFormInput,
} from '@/lib/debts';

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
  const [debt, setDebt] = useState<Debt | null>(null);
  const [loading, setLoading] = useState(isEdit);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmAdvance, setConfirmAdvance] = useState(false);

  const loadDebt = (debtId: string) =>
    getDebtById(debtId).then((loaded) => {
      if (!loaded) {
        setNotFound(true);
        return;
      }
      setDebt(loaded);
      setForm({
        name: loaded.name,
        creditor: loaded.creditor ?? '',
        outstanding: loaded.outstandingBalanceSatang !== null ? String(loaded.outstandingBalanceSatang / 100) : '',
        amountDue: loaded.amountDueSatang !== null ? String(loaded.amountDueSatang / 100) : '',
        minimum: loaded.minimumPaymentSatang !== null ? String(loaded.minimumPaymentSatang / 100) : '',
        dueDate: loaded.dueDate ?? '',
        recurringDueDay: loaded.recurringDueDay !== null ? String(loaded.recurringDueDay) : '',
        paymentMode: loaded.paymentMode,
        interestRateAnnual: loaded.interestRateAnnual !== null ? String(loaded.interestRateAnnual) : '',
        notes: loaded.notes ?? '',
      });
    });

  useIonViewWillEnter(() => {
    if (!id) {
      setForm(EMPTY);
      setDebt(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadDebt(id)
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

  const handleAdvanceCycle = async () => {
    if (!debt) return;
    setConfirmAdvance(false);
    setBusy(true);
    try {
      await advanceDebtCycle(debt);
      await loadDebt(debt.id);
      setNotice('เริ่มรอบใหม่แล้ว');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เริ่มรอบใหม่ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  };

  const advancePreview = debt ? previewCycleAdvance(debt) : null;

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
                  <DateField value={form.dueDate} onChange={(value) => setForm({ ...form, dueDate: value })} />
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
            {isEdit && advancePreview && (
              <IonButton expand="block" fill="outline" disabled={busy} onClick={() => setConfirmAdvance(true)}>
                เริ่มรอบใหม่
              </IonButton>
            )}
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

        <IonAlert
          isOpen={confirmAdvance}
          onDidDismiss={() => setConfirmAdvance(false)}
          header="เริ่มรอบใหม่?"
          message={
            advancePreview
              ? `เลื่อนวันครบกำหนดจาก ${formatThaiDateLabel(advancePreview.previousDueDate ?? '') ?? advancePreview.previousDueDate} เป็น ${formatThaiDateLabel(advancePreview.nextDueDate) ?? advancePreview.nextDueDate} และคำนวณยอดจ่ายรอบนี้ใหม่ (ไม่แตะยอดคงเหลือ ต้องแก้เองถ้ายอดเปลี่ยน)`
              : undefined
          }
          buttons={[
            { text: 'ยกเลิก', role: 'cancel', handler: () => setConfirmAdvance(false) },
            { text: 'เริ่มรอบใหม่', handler: () => { void handleAdvanceCycle(); } },
          ]}
        />

        <IonToast isOpen={notice !== ''} message={notice} duration={2500} color="success" onDidDismiss={() => setNotice('')} />
      </IonContent>
    </IonPage>
  );
};

export default DebtFormPage;
