import { useState } from 'react';
import { IonContent, IonHeader, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import TransactionRow from '@/components/TransactionRow';
import { listRecentTransactions, type Transaction } from '@/lib/transactions';

const TransactionsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [error, setError] = useState('');

  const load = async (event?: CustomEvent) => {
    try {
      setTransactions(await listRecentTransactions());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายการไม่สำเร็จ');
    } finally {
      (event?.target as HTMLIonRefresherElement | undefined)?.complete();
    }
  };

  useIonViewWillEnter(() => {
    void load();
  });

  return (
    <IonPage>
      <IonHeader className="ion-no-border"><IonToolbar /></IonHeader>
      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void load(e)}>
          <IonRefresherContent />
        </IonRefresher>

        <PageHeader title="รายการ" subtitle="ธุรกรรมทั้งหมดของคุณ" />

        {transactions === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && (
          <IonText color="danger"><p>{error}</p></IonText>
        )}

        {transactions?.length === 0 && (
          <div className="tl-card tl-empty">
            <p>ยังไม่มีรายการ — ลองสแกนสลิปแรกของคุณดู</p>
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

export default TransactionsPage;
