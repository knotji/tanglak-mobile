import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import PageHeader from '@/components/PageHeader';

const DebtsPage: React.FC = () => (
  <IonPage>
    <IonHeader className="ion-no-border"><IonToolbar /></IonHeader>
    <IonContent className="ion-padding" fullscreen>
      <PageHeader title="หนี้สิน" subtitle="รายการหนี้และยอดผ่อนแต่ละงวด" />
      <div className="tl-card tl-empty">
        <p>ยังไม่มีข้อมูลหนี้สิน</p>
      </div>
    </IonContent>
  </IonPage>
);

export default DebtsPage;
