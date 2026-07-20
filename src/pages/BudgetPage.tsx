import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import PageHeader from '@/components/PageHeader';

const BudgetPage: React.FC = () => (
  <IonPage>
    <IonHeader className="ion-no-border">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref="/tabs/more" text="" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding" fullscreen>
      <PageHeader title="งบประมาณ" subtitle="งบประมาณรายเดือน" />
      <div className="tl-card tl-empty">
        <p>ยังไม่ได้ตั้งงบประมาณ</p>
      </div>
    </IonContent>
  </IonPage>
);

export default BudgetPage;
