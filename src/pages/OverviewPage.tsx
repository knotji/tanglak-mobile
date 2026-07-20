import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import PageHeader from '@/components/PageHeader';

const OverviewPage: React.FC = () => (
  <IonPage>
    <IonHeader className="ion-no-border">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref="/tabs/more" text="" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding" fullscreen>
      <PageHeader title="ภาพรวม" subtitle="ภาพรวมการเงินของคุณ" />
      <div className="tl-card tl-empty">
        <p>ยังไม่มีข้อมูล</p>
      </div>
    </IonContent>
  </IonPage>
);

export default OverviewPage;
