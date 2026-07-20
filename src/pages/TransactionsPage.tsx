import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const TransactionsPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>รายการ</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>รายการธุรกรรมทั้งหมด (จะพอร์ตมาจาก tanglak/src/app/transactions)</p>
    </IonContent>
  </IonPage>
);

export default TransactionsPage;
