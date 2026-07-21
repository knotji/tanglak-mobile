import { useState } from 'react';
import { IonContent, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, useIonViewWillEnter } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import TransactionList from '@/components/TransactionList';
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
