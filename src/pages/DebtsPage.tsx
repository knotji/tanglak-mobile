import { useState } from 'react';
import {
  IonContent,
  IonFab,
  IonFabButton,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import DebtCard from '@/components/DebtCard';
import { listDebts, type Debt } from '@/lib/debts';

const DebtsPage: React.FC = () => {
  const history = useHistory();
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
            <p>ยังไม่มีข้อมูลหนี้สิน — แตะปุ่ม + เพื่อเพิ่มหนี้แรกของคุณ</p>
          </div>
        )}

        {debts?.map((debt, index) => (
          <button
            key={debt.id}
            type="button"
            className="tl-tap-row"
            onClick={() => history.push(`/debts/${debt.id}/edit`)}
            style={{ marginTop: index === 0 ? 0 : 12 }}
          >
            <DebtCard debt={debt} />
          </button>
        ))}

        <IonFab vertical="bottom" horizontal="end" slot="fixed" style={{ marginBottom: 8 }}>
          <IonFabButton onClick={() => history.push('/debts/new')} aria-label="เพิ่มหนี้">
            <IonIcon icon={addOutline} />
          </IonFabButton>
        </IonFab>
      </IonContent>
    </IonPage>
  );
};

export default DebtsPage;
