import { useState } from 'react';
import { IonButton, IonContent, IonDatetime, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText } from '@ionic/react';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import TransactionList from '@/components/TransactionList';
import { listTransactionsForMonth, type Transaction } from '@/lib/transactions';
import { currentBangkokMonth, shiftBangkokMonth } from '@/lib/bangkokDate';
import { formatThaiMonthYearLabel } from '@/lib/date';
import { useIonViewData } from '@/lib/useIonViewData';

const MonthPicker: React.FC<{ month: string; onChange: (month: string) => void }> = ({ month, onChange }) => {
  const [open, setOpen] = useState(false);
  const label = formatThaiMonthYearLabel(month) ?? month;

  return (
    <div className="tl-card tl-month-picker">
      <IonButton fill="clear" onClick={() => onChange(shiftBangkokMonth(month, -1))} aria-label="เดือนก่อนหน้า" style={{ '--color': '#4f46e5' }}>
        <IonIcon aria-hidden="true" icon={chevronBackOutline} slot="icon-only" />
      </IonButton>
      <button type="button" className="tl-month-picker__label" onClick={() => setOpen(true)}>
        {label}
      </button>
      <IonButton fill="clear" onClick={() => onChange(shiftBangkokMonth(month, 1))} aria-label="เดือนถัดไป" style={{ '--color': '#4f46e5' }}>
        <IonIcon aria-hidden="true" icon={chevronForwardOutline} slot="icon-only" />
      </IonButton>

      <IonModal className="tl-compact-modal" isOpen={open} onDidDismiss={() => setOpen(false)}>
        <div className="tl-month-sheet">
          <IonDatetime
            presentation="month-year"
            locale="th-TH-u-ca-gregory"
            value={`${month}-01`}
            onIonChange={(e) => {
              const raw = Array.isArray(e.detail.value) ? e.detail.value[0] : e.detail.value;
              const match = typeof raw === 'string' ? raw.match(/^(\d{4}-\d{2})/) : null;
              if (match) onChange(match[1]);
            }}
          />
          <IonButton expand="block" className="ion-margin-top" onClick={() => setOpen(false)}>เสร็จสิ้น</IonButton>
        </div>
      </IonModal>
    </div>
  );
};

const TransactionsPage: React.FC = () => {
  const [month, setMonth] = useState(() => currentBangkokMonth());
  // Deliberately does NOT clear transactions first on every tab revisit --
  // useIonViewData's reload(false) (the default, fired by its own internal
  // useIonViewWillEnter) leaves old data visible while a background refetch
  // runs, so revisiting this tab doesn't flash a spinner over data that's
  // still correct. Explicit month changes (handleMonthChange below) call
  // reload(true) instead, which does clear first -- that's a genuine
  // "we don't have this data yet" transition, unlike a tab revisit.
  const { data: transactions, error, reload, setData: setTransactions } = useIonViewData<Transaction[]>(
    () => listTransactionsForMonth(month),
    'โหลดรายการไม่สำเร็จ',
    [month],
  );

  const isCurrentMonth = month === currentBangkokMonth();

  const handleMonthChange = (nextMonth: string) => {
    setMonth(nextMonth);
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void reload(false, e)}>
          <IonRefresherContent />
        </IonRefresher>

        <PageHeader title="รายการ" subtitle="ธุรกรรมทั้งหมดของคุณ" />

        <MonthPicker month={month} onChange={handleMonthChange} />

        {transactions === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && (
          <IonText color="danger"><p>{error}</p></IonText>
        )}

        {transactions?.length === 0 && (
          <div className="tl-card tl-empty" style={{ marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
            <p>{isCurrentMonth ? 'ยังไม่มีรายการเดือนนี้ — ลองสแกนสลิปแรกของคุณดู' : 'ไม่มีรายการในเดือนนี้'}</p>
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <div style={{ marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
            <TransactionList
              transactions={transactions}
              onDeleted={(id) => setTransactions((current) => current?.filter((t) => t.id !== id) ?? current)}
            />
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TransactionsPage;
