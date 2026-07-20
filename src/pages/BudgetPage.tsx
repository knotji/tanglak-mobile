import { IonBackButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';

const BudgetPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref="/tabs/more" />
        </IonButtons>
        <IonTitle>งบประมาณ</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>งบประมาณรายเดือน (จะพอร์ตมาจาก tanglak/src/app/budget)</p>
    </IonContent>
  </IonPage>
);

export default BudgetPage;
