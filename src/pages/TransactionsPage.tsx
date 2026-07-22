import { useState } from 'react';
import { IonButton, IonContent, IonDatetime, IonIcon, IonModal, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, useIonViewWillEnter } from '@ionic/react';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import TransactionList from '@/components/TransactionList';
import { listTransactionsForMonth, type Transaction } from '@/lib/transactions';
import { currentBangkokMonth, shiftBangkokMonth } from '@/lib/bangkokDate';
import { formatThaiMonthYearLabel } from '@/lib/date';

const MonthPicker: React.FC<{ month: string; onChange: (month: string) => void }> = ({ month, onChange }) => {
  const [open, setOpen] = useState(false);
  const label = formatThaiMonthYearLabel(month) ?? month;

  return (
    <div className="tl-card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 6px' }}>
      <IonButton fill="clear" onClick={() => onChange(shiftBangkokMonth(month, -1))} aria-label="เดือนก่อนหน้า">
        <IonIcon icon={chevronBackOutline} slot="icon-only" />
      </IonButton>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, color: 'var(--ion-text-color)', padding: '8px 12px' }}
      >
        {label}
      </button>
      <IonButton fill="clear" onClick={() => onChange(shiftBangkokMonth(month, 1))} aria-label="เดือนถัดไป">
        <IonIcon icon={chevronForwardOutline} slot="icon-only" />
      </IonButton>

      <IonModal className="tl-compact-modal" isOpen={open} onDidDismiss={() => setOpen(false)}>
        <div style={{ padding: 16 }}>
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
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState('');

  const load = async (targetMonth: string, event?: CustomEvent) => {
    try {
      setTransactions(await listTransactionsForMonth(targetMonth));
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายการไม่สำเร็จ');
    } finally {
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  };

  useIonViewWillEnter(() => {
    setTransactions(null);
    void load(month);
  }, [month]);

  const isCurrentMonth = month === currentBangkokMonth();

  const handleMonthChange = (nextMonth: string) => {
    setMonth(nextMonth);
    setTransactions(null);
    void load(nextMonth);
  };

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void load(month, e)}>
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
          <div className="tl-card tl-empty">
            <p>{isCurrentMonth ? 'ยังไม่มีรายการเดือนนี้ — ลองสแกนสลิปแรกของคุณดู' : 'ไม่มีรายการในเดือนนี้'}</p>
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <TransactionList
            transactions={transactions}
            onDeleted={(id) => setTransactions((current) => current?.filter((t) => t.id !== id) ?? current)}
          />
        )}
      </IonContent>
    </IonPage>
  );
};

export default TransactionsPage;
