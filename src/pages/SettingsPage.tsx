import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonToolbar } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';

const SettingsPage: React.FC = () => (
  <IonPage>
    <IonHeader className="ion-no-border">
      <IonToolbar>
        <IonButtons slot="start">
          <IonBackButton defaultHref="/tabs/more" text="" />
        </IonButtons>
      </IonToolbar>
    </IonHeader>
    <IonContent className="ion-padding" fullscreen>
      <PageHeader title="ตั้งค่า" subtitle="บัญชีและการเชื่อมต่อ" />
      <IonButton expand="block" color="danger" fill="outline" onClick={() => supabase.auth.signOut()}>
        ออกจากระบบ
      </IonButton>
    </IonContent>
  </IonPage>
);

export default SettingsPage;
