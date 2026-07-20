import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const OverviewPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref="/tabs/more" />
        </IonButtons>
        <IonTitle>ภาพรวม</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>ภาพรวมการเงิน (จะพอร์ตมาจาก tanglak/src/app/overview)</p>
    </IonContent>
  </IonPage>
);

export default OverviewPage;
