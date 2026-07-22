import { useState } from 'react';
import { IonContent, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, useIonRouter, useIonViewWillEnter } from '@ionic/react';
import { cardOutline, scanOutline, trendingDownOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import TransactionList from '@/components/TransactionList';
import { listTodayTransactions, type Transaction } from '@/lib/transactions';
import { formatTHB } from '@/lib/money';

function sumSatang(transactions: Transaction[], types: Transaction['type'][]): number {
  return transactions.filter((t) => types.includes(t.type)).reduce((total, t) => total + t.amountSatang, 0);
}

const TodayPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState('');
  const router = useIonRouter();

  const load = async (event?: CustomEvent) => {
    try {
      setTransactions(await listTodayTransactions());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดข้อมูลไม่สำเร็จ');
    } finally {
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  };

  useIonViewWillEnter(() => {
    void load();
  });

  const expenseSatang = transactions ? sumSatang(transactions, ['expense', 'debt_payment']) : 0;
  const incomeSatang = transactions ? sumSatang(transactions, ['income', 'refund']) : 0;

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void load(e)}>
          <IonRefresherContent />
        </IonRefresher>

        <PageHeader title="วันนี้" subtitle="สรุปยอดใช้จ่ายวันนี้และรายการล่าสุด" />

        {transactions === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {transactions && (
          <>
            <div className="tl-hero-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="tl-hero-title">รายจ่ายวันนี้</span>
                  <div className="tl-hero-amount">{formatTHB(expenseSatang)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="tl-hero-title">รายรับวันนี้</span>
                  <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4, color: '#34d399', fontVariantNumeric: 'tabular-nums' }}>
                    {formatTHB(incomeSatang, { showPositiveSign: true })}
                  </div>
                </div>
              </div>
            </div>

            <div className="tl-quick-actions">
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
              <button
                type="button"
                onClick={() => router.push('/tabs/debts', 'forward', 'push')}
                className="tl-action-chip"
                style={{ border: 'none', background: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                <IonIcon icon={trendingDownOutline} style={{ color: '#d97706' }} />
                <span>จัดการหนี้สิน</span>
              </button>
            </div>
          </>
        )}

        {transactions?.length === 0 && (
          <div className="tl-card tl-empty" style={{ marginTop: 16 }}>
            <p style={{ margin: 0, fontWeight: 600 }}>วันนี้ยังไม่มีรายการ</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--tl-text-secondary)' }}>สแกนสลิปหรือบันทึกรายการเพื่อเริ่มติดตาม</p>
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <div style={{ marginTop: 16 }}>
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

export default TodayPage;
