import { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonInput, IonPage, IonSpinner, IonText } from '@ionic/react';
import { logoGoogle } from 'ionicons/icons';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabaseClient';
import BrandMark from '@/components/BrandMark';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleSignIn = async () => {
    setError(null);
    setLoading(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (signInError) setError('อีเมลหรือรหัสผ่านไม่ถูกต้อง');
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setGoogleLoading(true);
    try {
      const isNative = Capacitor.isNativePlatform();
      const redirectTo = isNative
        ? 'tanglak://login-callback'
        : `${window.location.origin}/tabs/today`;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: isNative,
        },
      });

      if (oauthError) throw oauthError;

      if (isNative && data?.url) {
        await Browser.open({ url: data.url });
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เข้าสู่ระบบด้วย Google ไม่สำเร็จ');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="tl-login-shell">
          <div className="tl-login-intro">
            <BrandMark size={72} />
            <h1>ตั้งหลัก</h1>
            <p style={{ fontSize: 14, color: 'var(--tl-text-secondary)', marginTop: 6, fontWeight: 500 }}>
              เห็นเงินเข้าออกชัด วางแผนชีวิตได้ง่ายขึ้น
            </p>
          </div>

          <div className="tl-card tl-login-panel">
            <IonButton
              expand="block"
              fill="outline"
              disabled={loading || googleLoading}
              onClick={() => void handleGoogleSignIn()}
              style={{
                '--border-radius': 'var(--tl-radius-sm)',
                '--border-color': '#cbd5e1',
                '--border-width': '1.5px',
                '--background': '#ffffff',
                '--color': '#0f172a',
                fontWeight: 700,
                minHeight: 48,
                marginBottom: 18,
              }}
            >
              {googleLoading ? (
                <IonSpinner name="dots" />
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <IonIcon icon={logoGoogle} style={{ fontSize: 20, color: '#ea4335' }} />
                  <span>เข้าสู่ระบบด้วย Google</span>
                </div>
              )}
            </IonButton>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--tl-border)' }} />
              <span style={{ fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 600 }}>หรือเข้าสู่ระบบด้วยอีเมล</span>
              <div style={{ flex: 1, height: 1, background: 'var(--tl-border)' }} />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>อีเมล</label>
              <IonInput
                fill="outline"
                type="email"
                inputmode="email"
                autocapitalize="off"
                placeholder="name@example.com"
                value={email}
                onIonInput={(e) => setEmail(e.detail.value ?? '')}
              />
            </div>
            <div style={{ marginBottom: 6 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#334155', marginBottom: 6 }}>รหัสผ่าน</label>
              <IonInput
                fill="outline"
                type="password"
                placeholder="••••••••"
                value={password}
                onIonInput={(e) => setPassword(e.detail.value ?? '')}
              />
            </div>

            {error && (
              <IonText color="danger">
                <p style={{ fontSize: 13, marginTop: 12, marginBottom: 0, fontWeight: 600 }}>{error}</p>
              </IonText>
            )}

            <IonButton
              expand="block"
              className="ion-margin-top"
              disabled={loading || googleLoading || !email || !password}
              onClick={handleSignIn}
              style={{
                '--border-radius': 'var(--tl-radius-sm)',
                '--background': 'linear-gradient(135deg, #24324a 0%, #443f78 100%)',
                '--box-shadow': '0 4px 14px rgba(15, 23, 42, 0.25)',
                fontWeight: 700,
                minHeight: 48,
              }}
            >
              {loading ? <IonSpinner name="dots" /> : 'เข้าสู่ระบบ'}
            </IonButton>
          </div>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default LoginPage;
