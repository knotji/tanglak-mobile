import { IonContent, IonHeader, IonIcon, IonItem, IonLabel, IonList, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { cardOutline, settingsOutline, statsChartOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';

const MorePage: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>เพิ่มเติม</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList inset>
          <IonItem button onClick={() => history.push('/overview')}>
            <IonIcon icon={statsChartOutline} slot="start" />
            <IonLabel>ภาพรวม</IonLabel>
          </IonItem>
          <IonItem button onClick={() => history.push('/budget')}>
            <IonIcon icon={cardOutline} slot="start" />
            <IonLabel>งบประมาณ</IonLabel>
          </IonItem>
          <IonItem button onClick={() => history.push('/settings')}>
            <IonIcon icon={settingsOutline} slot="start" />
            <IonLabel>ตั้งค่า</IonLabel>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default MorePage;
