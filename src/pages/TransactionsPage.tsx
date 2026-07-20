import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import PageHeader from '@/components/PageHeader';

const TransactionsPage: React.FC = () => (
  <IonPage>
    <IonHeader className="ion-no-border"><IonToolbar /></IonHeader>
    <IonContent className="ion-padding" fullscreen>
      <PageHeader title="รายการ" subtitle="ธุรกรรมทั้งหมดของคุณ" />
      <div className="tl-card tl-empty">
        <p>ยังไม่มีรายการ</p>
      </div>
    </IonContent>
  </IonPage>
);

export default TransactionsPage;
