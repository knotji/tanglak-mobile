import { useState } from 'react';
import { IonButton, IonContent, IonInput, IonPage, IonSpinner, IonText } from '@ionic/react';
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
    if (signInError) setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px' }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <p style={{ fontSize: 34, fontWeight: 700, color: 'var(--ion-color-primary)', margin: 0 }}>ตั้งหลัก</p>
            <p style={{ fontSize: 14, color: 'var(--tl-text-secondary)', marginTop: 6 }}>
              เห็นเงินชัด จัดหนี้เป็น ใช้ชีวิตต่อได้
            </p>
          </div>

          <div className="tl-card">
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ion-text-color)', marginBottom: 6 }}>อีเมล</label>
              <IonInput
                fill="outline"
                type="email"
                inputmode="email"
                autocapitalize="off"
                value={email}
                onIonInput={(e) => setEmail(e.detail.value ?? '')}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--ion-text-color)', marginBottom: 6 }}>รหัสผ่าน</label>
              <IonInput
                fill="outline"
                type="password"
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? '')}
              />
            </div>

            {error && (
              <IonText color="danger">
                <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0 }}>{error}</p>
              </IonText>
            )}

            <IonButton expand="block" className="ion-margin-top" disabled={loading || !email || !password} onClick={handleSignIn}>
              {loading ? <IonSpinner name="dots" /> : 'เข้าสู่ระบบ'}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
