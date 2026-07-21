import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';

const SettingsPage: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);

  useIonViewWillEnter(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  });

  return (
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

        <div className="tl-card">
          <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 700 }}>เข้าสู่ระบบด้วย</p>
          <p style={{ margin: '4px 0 0', fontSize: 15, fontWeight: 700 }}>{email ?? '—'}</p>
        </div>

        <IonButton expand="block" color="danger" fill="outline" className="ion-margin-top" onClick={() => supabase.auth.signOut()}>
          ออกจากระบบ
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
