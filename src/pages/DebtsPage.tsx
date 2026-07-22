import { useState } from 'react';
import {
  IonContent,
  IonFab,
  IonFabButton,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonText,
  useIonViewWillEnter,
} from '@ionic/react';
import { addOutline, chevronForwardOutline, trendingUpOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';
import DebtCard from '@/components/DebtCard';
import { listDebts, type Debt } from '@/lib/debts';
import { filterActiveDebts } from '@/lib/debtPortfolioStrategy';

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
      <IonContent className="ion-padding" fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(e) => void load(e)}>
          <IonRefresherContent />
        </IonRefresher>

        {/* Bottom padding keeps the floating "+" FAB from covering the last card's text. */}
        <div style={{ paddingBottom: 72 }}>
        <PageHeader title="หนี้สิน" subtitle="รายการหนี้และยอดผ่อนแต่ละงวด" />

        {debts === null && !error && (
          <div className="ion-text-center ion-margin-top"><IonSpinner /></div>
        )}

        {error && <IonText color="danger"><p>{error}</p></IonText>}

        {debts && filterActiveDebts(debts).length >= 2 && (
          <button type="button" className="tl-tap-row" onClick={() => history.push('/debts/strategy')} style={{ marginBottom: 16 }}>
            <div className="tl-card" style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 100%)', borderColor: '#c7d2fe' }}>
              <div className="tl-icon-badge tl-icon-badge--transfer" style={{ background: '#4f46e5', color: '#ffffff' }}>
                <IonIcon icon={trendingUpOutline} />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: 'var(--ion-text-color)' }}>เปรียบเทียบกลยุทธ์โปะหนี้</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 500 }}>
                  เลือกแผน Snowball หรือ Avalanche เพื่อประหยัดดอกเบี้ยมากที่สุด
                </p>
              </div>
              <IonIcon icon={chevronForwardOutline} style={{ fontSize: 16, color: '#4f46e5' }} />
            </div>
          </button>
        )}

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
        </div>

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
