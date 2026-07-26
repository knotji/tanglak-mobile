import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonToggle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import { notificationsOutline, personOutline, logOutOutline, fingerPrintOutline } from 'ionicons/icons';
import PageHeader from '@/components/PageHeader';
import { supabase } from '@/lib/supabaseClient';
import { listDebts } from '@/lib/debts';
import { requestNotificationPermission, scheduleDebtReminders, cancelAllDebtReminders } from '@/lib/notifications';
import { useDebtReminderEnabled, setDebtReminderEnabled } from '@/lib/notificationPrefs';
import { isBiometricLockEnabled, setBiometricLockEnabled, authenticateBiometrics } from '@/lib/biometrics';

const SettingsPage: React.FC = () => {
  const [email, setEmail] = useState<string | null>(null);
  const notifyEnabled = useDebtReminderEnabled();
  const [biometricEnabled, setBiometricEnabled] = useState(() => isBiometricLockEnabled());
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useIonViewWillEnter(() => {
    void supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  });

  const handleToggleNotify = async (checked: boolean) => {
    if (checked) {
      setBusy(true);
      const granted = await requestNotificationPermission();
      if (granted) {
        const debts = await listDebts();
        const count = await scheduleDebtReminders(debts);
        setDebtReminderEnabled(true);
        setNotice(count > 0 ? `ตั้งเตือนวันชำระหนี้แล้ว ${count} รายการ` : 'เปิดการแจ้งเตือนแล้ว');
      } else {
        setNotice('ยังไม่ได้รับการอนุญาตการแจ้งเตือน');
        setDebtReminderEnabled(false);
      }
      setBusy(false);
    } else {
      setDebtReminderEnabled(false);
      await cancelAllDebtReminders();
      setNotice('ปิดการแจ้งเตือนแล้ว');
    }
  };

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
        <PageHeader title="ตั้งค่า" subtitle="บัญชี ความปลอดภัย และการแจ้งเตือน" />

        <div className="tl-card" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <div className="tl-icon-badge tl-icon-badge--income" style={{ width: 44, height: 44, fontSize: 20 }}>
            <IonIcon icon={personOutline} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 700 }}>บัญชีผู้ใช้งาน</p>
            <p style={{ margin: '2px 0 0', fontSize: 15, fontWeight: 700 }}>{email ?? '—'}</p>
          </div>
        </div>

        {/* Biometric App Lock Toggle */}
        <div className="tl-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="tl-icon-badge tl-icon-badge--expense" style={{ width: 40, height: 40, fontSize: 18 }}>
                <IonIcon icon={fingerPrintOutline} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>ล็อกแอปด้วย Face ID / ลายนิ้วมือ</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)' }}>
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
        </div>

        {/* Debt Reminder Toggle */}
        <div className="tl-card" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="tl-icon-badge tl-icon-badge--transfer" style={{ width: 40, height: 40, fontSize: 18 }}>
                <IonIcon icon={notificationsOutline} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>แจ้งเตือนวันครบกำหนดชำระหนี้</p>
                <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--tl-text-secondary)' }}>
                  เตือนล่วงหน้า 3 วัน เวลา 09:00 น.
                </p>
              </div>
            </div>
            {busy ? (
              <IonSpinner name="dots" />
            ) : (
              <IonToggle
                checked={notifyEnabled}
                onIonChange={(e) => void handleToggleNotify(e.detail.checked)}
                aria-label="แจ้งเตือนวันชำระหนี้"
              />
            )}
          </div>
          {notice && (
            <p style={{ margin: '10px 0 0', fontSize: 12.5, color: '#4f46e5', fontWeight: 600 }}>{notice}</p>
          )}
        </div>

        <div style={{ marginTop: 24, paddingBottom: 'calc(24px + env(safe-area-inset-bottom, 0px))' }}>
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
              <IonIcon icon={logOutOutline} style={{ fontSize: 18 }} />
              <span>ออกจากระบบ</span>
            </div>
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
