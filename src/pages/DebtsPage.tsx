import { useState } from 'react';
import { IonContent, IonHeader, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonText, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import DebtCard from '@/components/DebtCard';
import { listDebts, type Debt } from '@/lib/debts';

const DebtsPage: React.FC = () => {
  const [debts, setDebts] = useState<Debt[] | null>(null);
  const [error, setError] = useState('');

  const load = async (event?: CustomEvent) => {
    try {
      setDebts(await listDebts());
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'โหลดรายการหนี้ไม่สำเร็จ');
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

        <PageHeader title="หนี้สิน" subtitle="รายการหนี้และยอดผ่อนแต่ละงวด" />

        {debts === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {debts?.length === 0 && (
          <div className="tl-card tl-empty">
            <p>ยังไม่มีข้อมูลหนี้สิน</p>
          </div>
        )}

        {debts?.map((debt) => <DebtCard key={debt.id} debt={debt} />)}
      </IonContent>
    </IonPage>
  );
};

export default DebtsPage;
