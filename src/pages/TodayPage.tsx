import { useState } from 'react';
import { IonContent, IonHeader, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import TransactionRow from '@/components/TransactionRow';
import { listTodayTransactions, type Transaction } from '@/lib/transactions';
import { formatTHB } from '@/lib/money';

function sumSatang(transactions: Transaction[], types: Transaction['type'][]): number {
  return transactions.filter((t) => types.includes(t.type)).reduce((total, t) => total + t.amountSatang, 0);
}

const TodayPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState('');

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

  // Transfers aren't spending/income -- same convention as the web app
  // (see tanglak/src/lib/finance/categories.ts on the "transfers" category).
  const expenseSatang = transactions ? sumSatang(transactions, ['expense', 'debt_payment']) : 0;
  const incomeSatang = transactions ? sumSatang(transactions, ['income', 'refund']) : 0;

  return (
    <IonPage>
      <IonHeader className="ion-no-border"><IonToolbar /></IonHeader>
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
          <div className="tl-card" style={{ display: 'flex', gap: 24 }}>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 700 }}>รายจ่ายวันนี้</p>
              <p className="tl-amount tl-amount--expense" style={{ fontSize: 22, margin: '4px 0 0' }}>{formatTHB(expenseSatang)}</p>
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 700 }}>รายรับวันนี้</p>
              <p className="tl-amount tl-amount--income" style={{ fontSize: 22, margin: '4px 0 0' }}>{formatTHB(incomeSatang, { showPositiveSign: true })}</p>
            </div>
          </div>
        )}

        {transactions?.length === 0 && (
          <div className="tl-card tl-empty">
            <p>วันนี้ยังไม่มีรายการ</p>
          </div>
        )}

        {transactions && transactions.length > 0 && (
          <div className="tl-card" style={{ padding: '4px 16px' }}>
            {transactions.map((transaction, index) => (
              <div key={transaction.id} style={{ borderTop: index === 0 ? 'none' : '1px solid var(--tl-border)' }}>
                <TransactionRow transaction={transaction} />
              </div>
            ))}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default TodayPage;
