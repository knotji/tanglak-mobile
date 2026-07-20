import { IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import PageHeader from '@/components/PageHeader';

const TodayPage: React.FC = () => (
  <IonPage>
    <IonHeader className="ion-no-border"><IonToolbar /></IonHeader>
    <IonContent className="ion-padding" fullscreen>
      <PageHeader title="วันนี้" subtitle="สรุปยอดใช้จ่ายวันนี้และรายการล่าสุด" />
      <div className="tl-card tl-empty">
        <p>ยังไม่มีข้อมูล — เริ่มจากสแกนสลิปแรกของคุณ</p>
      </div>
    </IonContent>
  </IonPage>
);

export default TodayPage;
