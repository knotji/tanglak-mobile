import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonToggle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import { personOutline, logOutOutline, fingerPrintOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { isBiometricLockEnabled, setBiometricLockEnabled, authenticateBiometrics } from '@/lib/biometrics';

const SettingsPage: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const [biometricEnabled, setBiometricEnabled] = useState(() => isBiometricLockEnabled());
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useIonViewWillEnter(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  });

  const handleToggleBiometric = async (checked: boolean) => {
    setBusy(true);
    try {
      const success = await authenticateBiometrics(checked ? 'ยืนยันตัวตนเพื่อเปิดระบบล็อกแอป' : 'ยืนยันตัวตนเพื่อปิดระบบล็อกแอป');
      if (success) {
        setBiometricLockEnabled(checked);
        setBiometricEnabled(checked);
        setNotice(checked ? 'เปิดระบบล็อกแอปด้วย Face ID / ลายนิ้วมือแล้ว' : 'ปิดระบบล็อกแอปแล้ว');
      } else {
        setNotice('ยืนยันตัวตนไม่สำเร็จ');
      }
    } catch {
      setNotice('เกิดข้อผิดพลาดในการยืนยันตัวตน');
    } finally {
      setBusy(false);
    }
  };

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
        <PageHeader title="ตั้งค่า" subtitle="บัญชีและความปลอดภัย" />

        <div className="tl-settings-stack">
          <div className="tl-card tl-profile-card">
            <div className="tl-icon-badge tl-icon-badge--income">
              <IonIcon aria-hidden="true" icon={personOutline} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p className="tl-profile-card__label">บัญชีผู้ใช้งาน</p>
              <p className="tl-profile-card__email">{email ?? '—'}</p>
            </div>
          </div>

          <div className="tl-card tl-setting-row">
            <div className="tl-setting-row__copy">
              <div className="tl-icon-badge tl-icon-badge--expense">
                <IonIcon aria-hidden="true" icon={fingerPrintOutline} />
              </div>
              <div style={{ minWidth: 0 }}>
                <p className="tl-setting-row__title">ล็อกแอปด้วย Face ID / ลายนิ้วมือ</p>
                <p className="tl-setting-row__hint">
                  ยืนยันตัวตนทุกครั้งเมื่อเปิดแอปการเงิน
                </p>
              </div>
            </div>
            {busy ? (
              <IonSpinner name="dots" />
            ) : (
              <IonToggle
                checked={biometricEnabled}
                onIonChange={(e) => void handleToggleBiometric(e.detail.checked)}
                aria-label="ล็อกแอปด้วยระบบชีวมิติ"
              />
            )}
          </div>

          {notice && <p className="tl-inline-notice" role="status">{notice}</p>}
        </div>

        <div className="tl-danger-zone">
          <IonButton
            expand="block"
            fill="outline"
            color="danger"
            onClick={() => supabase.auth.signOut()}
            style={{
              '--border-radius': '999px',
              '--border-color': '#fecaca',
              '--color': '#dc2626',
              fontWeight: 700,
              fontSize: 15,
              minHeight: 48,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IonIcon aria-hidden="true" icon={logOutOutline} style={{ fontSize: 18 }} />
              <span>ออกจากระบบ</span>
            </div>
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
