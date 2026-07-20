import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const TodayPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonTitle>วันนี้</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>สรุปยอดใช้จ่ายวันนี้และรายการล่าสุด (จะพอร์ตมาจาก tanglak/src/app/today)</p>
    </IonContent>
  </IonPage>
);

export default TodayPage;
