import { useState } from 'react';
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, useIonRouter, useIonViewWillEnter } from '@ionic/react';
import { cardOutline, scanOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import TransactionList from '@/components/TransactionList';
import DailySpendCard from '@/components/DailySpendCard';
import { listTodayTransactions, type Transaction } from '@/lib/transactions';
import { getOverviewSnapshot, type OverviewSnapshot } from '@/lib/overview';
import { calculateDailySpendLimit } from '@/lib/dailySpendLimit';
import { usePrivacyMode, maskAmount } from '@/lib/privacyStore';
import { formatTHB } from '@/lib/money';

function sumSatang(transactions: Transaction[], types: Transaction['type'][]): number {
  return transactions.filter((t) => types.includes(t.type)).reduce((total, t) => total + t.amountSatang, 0);
}

const TodayPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [snapshot, setSnapshot] = useState<OverviewSnapshot | null>(null);
  const [transactionsError, setTransactionsError] = useState('');
  const [snapshotError, setSnapshotError] = useState('');
  const router = useIonRouter();
  const isPrivacy = usePrivacyMode();

  const load = async (event?: CustomEvent) => {
    try {
      const transactionsTask = listTodayTransactions().then(
        (value) => {
          setTransactions(value);
          setTransactionsError('');
        },
        (reason: unknown) => {
        setTransactionsError(
          reason instanceof Error
            ? reason.message
            : 'โหลดรายการวันนี้ไม่สำเร็จ',
        );
        },
      );

      const snapshotTask = getOverviewSnapshot().then(
        (value) => {
          setSnapshot(value);
          setSnapshotError('');
        },
        () => {
          setSnapshotError('คำนวณงบที่ใช้ได้วันนี้ไม่สำเร็จ');
        },
      );

      await Promise.all([transactionsTask, snapshotTask]);
    } finally {
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  };

  useIonViewWillEnter(() => {
    void load();
  });

  const expenseSatang = transactions
    ? sumSatang(transactions, ['expense', 'debt_payment'])
    : null;
  const incomeSatang = transactions
    ? sumSatang(transactions, ['income', 'refund'])
    : null;

  const dailySpend = snapshot && expenseSatang !== null
    ? calculateDailySpendLimit(
      snapshot.totals.livingExpenseSatang + snapshot.totals.debtPaymentSatang,
      expenseSatang,
      0,
      snapshot.plannedIncomeSatang,
    )
    : null;

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void load(e)}>
          <IonRefresherContent />
        </IonRefresher>

        <PageHeader title="วันนี้" subtitle="สรุปยอดใช้จ่ายวันนี้และรายการล่าสุด" />

        {transactions === null && !transactionsError && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {transactionsError && <IonText color="danger"><p>{transactionsError}</p></IonText>}

        {transactions && (
          <>
            <div className="tl-hero-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="tl-hero-title">รายจ่ายวันนี้</span>
                  <div className="tl-hero-amount">{maskAmount(formatTHB(expenseSatang ?? 0), isPrivacy)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tl-hero-title">รายรับวันนี้</span>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                    {maskAmount(formatTHB(incomeSatang ?? 0, { showPositiveSign: true }), isPrivacy)}
                  </div>
                </div>
              </div>
            </div>

            <div className="tl-quick-actions" style={{ marginBottom: 16 }}>
              <button
                type="button"
                onClick={() => router.push('/tabs/upload', 'forward', 'push')}
                className="tl-action-chip"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <IonIcon icon={scanOutline} style={{ color: '#4f46e5' }} />
                <span>สแกนสลิป</span>
              </button>
              <button
                type="button"
                onClick={() => router.push('/tabs/transactions', 'forward', 'push')}
                className="tl-action-chip"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <IonIcon icon={cardOutline} style={{ color: '#0f172a' }} />
                <span>รายการทั้งหมด</span>
              </button>
            </div>

          </>
        )}

        {dailySpend && <DailySpendCard daily={dailySpend} />}
        {!dailySpend && !snapshotError && !transactionsError && (
          <SectionLoadingCard message="กำลังคำนวณงบที่ใช้ได้วันนี้…" />
        )}
        {snapshotError && (
          <SectionErrorCard message={snapshotError} />
        )}

        {transactions?.length === 0 && (
          <div className="tl-card tl-empty" style={{ marginTop: 16, marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
            <p style={{ margin: 0, fontWeight: 600 }}>วันนี้ยังไม่มีรายการ</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--tl-text-secondary)' }}>สแกนสลิปหรือบันทึกรายการเพื่อเริ่มติดตาม</p>
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <div style={{ marginTop: 16, marginBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
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

const SectionLoadingCard: React.FC<{ message: string }> = ({ message }) => (
  <div
    className="tl-card"
    style={{
      minHeight: 96,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      color: 'var(--tl-text-secondary)',
      fontSize: 13,
      fontWeight: 600,
    }}
  >
    <IonSpinner name="crescent" />
    <span>{message}</span>
  </div>
);

const SectionErrorCard: React.FC<{ message: string }> = ({ message }) => (
  <div
    className="tl-card"
    role="alert"
    style={{
      minHeight: 72,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      padding: 16,
      borderColor: '#fecaca',
      background: '#fff7f7',
      color: '#b91c1c',
      fontSize: 13,
      fontWeight: 700,
    }}
  >
    {message} — ดึงหน้าจอลงเพื่อลองใหม่
  </div>
);

export default TodayPage;
