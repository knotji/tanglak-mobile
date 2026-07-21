import { IonContent, IonIcon, IonItem, IonLabel, IonList, IonPage } from '@ionic/react';
import { cardOutline, chevronForwardOutline, settingsOutline, statsChartOutline, walletOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import PageHeader from '@/components/PageHeader';

const MorePage: React.FC = () => {
  const history = useHistory();

  return (
    <IonPage>
      <IonContent className="ion-padding" fullscreen>
        <PageHeader title="เพิ่มเติม" />
        <IonList className="tl-card" style={{ padding: 0 }} lines="full">
          <IonItem button detail={false} onClick={() => history.push('/overview')}>
            <IonIcon icon={statsChartOutline} slot="start" color="primary" />
            <IonLabel>ภาพรวม</IonLabel>
            <IonIcon icon={chevronForwardOutline} slot="end" color="medium" />
          </IonItem>
          <IonItem button detail={false} onClick={() => history.push('/budget')}>
            <IonIcon icon={cardOutline} slot="start" color="primary" />
            <IonLabel>งบประมาณ</IonLabel>
            <IonIcon icon={chevronForwardOutline} slot="end" color="medium" />
          </IonItem>
          <IonItem button detail={false} onClick={() => history.push('/accounts')}>
            <IonIcon icon={walletOutline} slot="start" color="primary" />
            <IonLabel>บัญชี</IonLabel>
            <IonIcon icon={chevronForwardOutline} slot="end" color="medium" />
          </IonItem>
          <IonItem button detail={false} lines="none" onClick={() => history.push('/settings')}>
            <IonIcon icon={settingsOutline} slot="start" color="primary" />
            <IonLabel>ตั้งค่า</IonLabel>
            <IonIcon icon={chevronForwardOutline} slot="end" color="medium" />
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default MorePage;
