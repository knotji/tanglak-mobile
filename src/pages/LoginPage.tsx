import { useState } from 'react';
import {
  IonButton,
  IonContent,
  IonInput,
  IonItem,
  IonList,
  IonPage,
  IonText,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import { supabase } from '@/lib/supabaseClient';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError(signInError.message);
  };

  return (
    <IonPage>
      <IonContent fullscreen className="ion-padding">
        <IonToolbar>
          <IonTitle>ตั้งหลัก</IonTitle>
        </IonToolbar>
        <IonList inset>
          <IonItem>
            <IonInput
              label="อีเมล"
              labelPlacement="stacked"
              type="email"
              value={email}
              onIonInput={(e) => setEmail(e.detail.value ?? '')}
            />
          </IonItem>
          <IonItem>
            <IonInput
              label="รหัสผ่าน"
              labelPlacement="stacked"
              type="password"
              value={password}
              onIonInput={(e) => setPassword(e.detail.value ?? '')}
            />
          </IonItem>
        </IonList>
        {error && (
          <IonText color="danger">
            <p className="ion-padding-start">{error}</p>
          </IonText>
        )}
        <IonButton expand="block" className="ion-margin-top" disabled={loading} onClick={handleSignIn}>
          เข้าสู่ระบบ
        </IonButton>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
