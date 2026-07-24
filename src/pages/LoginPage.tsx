import { useState } from 'react';
import { IonButton, IonContent, IonIcon, IonInput, IonPage, IonSpinner, IonText } from '@ionic/react';
import { walletOutline, logoGoogle } from 'ionicons/icons';
import { Browser } from '@capacitor/browser';
import { Capacitor } from '@capacitor/core';
import { supabase } from '@/lib/supabaseClient';

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
        <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '24px 20px calc(24px + env(safe-area-inset-bottom, 0px))', maxWidth: 440, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 20,
                background: 'linear-gradient(135deg, #0f172a 0%, #4f46e5 100%)',
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px -5px rgba(79, 70, 229, 0.4)',
                marginBottom: 16,
              }}
            >
              <IonIcon icon={walletOutline} style={{ fontSize: 32 }} />
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, color: 'var(--ion-color-primary)', margin: 0, letterSpacing: '-0.02em' }}>ตั้งหลัก</p>
            <p style={{ fontSize: 14, color: 'var(--tl-text-secondary)', marginTop: 6, fontWeight: 500 }}>
              เห็นเงินชัด จัดหนี้เป็น ใช้ชีวิตต่อได้
            </p>
          </div>

          <div className="tl-card" style={{ padding: '24px 20px' }}>
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
                '--background': 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
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
