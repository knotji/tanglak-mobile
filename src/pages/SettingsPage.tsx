import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { supabase } from '@/lib/supabaseClient';

const SettingsPage: React.FC = () => (
  <IonPage>
    <IonHeader>
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref="/tabs/more" />
        </IonButtons>
        <IonTitle>ตั้งค่า</IonTitle>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding">
      <p>บัญชี, การเชื่อมต่อ (จะพอร์ตมาจาก tanglak/src/app/settings)</p>
      <IonButton expand="block" color="danger" fill="outline" onClick={() => supabase.auth.signOut()}>
        ออกจากระบบ
      </IonButton>
    </IonContent>
  </IonPage>
);

export default SettingsPage;
