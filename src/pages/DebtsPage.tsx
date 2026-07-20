import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const DebtsPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>หนี้สิน</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>รายการหนี้และยอดผ่อนแต่ละงวด (จะพอร์ตมาจาก tanglak/src/app/debts)</p>
    </IonContent>
  </IonPage>
);

export default DebtsPage;
