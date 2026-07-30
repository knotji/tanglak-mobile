import { useState, useEffect } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonIcon } from '@ionic/react';
import { shieldCheckmarkOutline } from 'ionicons/icons';

export const PrivacyBlurOverlay: React.FC = () => {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    let sub: { remove: () => void } | null = null;

    if (Capacitor.isNativePlatform()) {
      void App.addListener('appStateChange', ({ isActive }) => {
        setIsBlurred(!isActive);
      }).then((handle) => {
        sub = handle;
      });
    }

    const handleVisibility = () => {
      if (document.hidden) {
        setIsBlurred(true);
      } else {
        setIsBlurred(false);
      }
    };

    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      sub?.remove();
      window.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  if (!isBlurred) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        textAlign: 'center',
        padding: 24,
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 22,
          background: 'linear-gradient(135deg, #6558d3 0%, #443f78 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 36,
          marginBottom: 16,
          boxShadow: '0 10px 30px rgba(79, 70, 229, 0.5)',
        }}
      >
        <IonIcon aria-hidden="true" icon={shieldCheckmarkOutline} />
      </div>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>ตั้งหลัก (TangLak)</h2>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
        พรางข้อมูลการเงินเพื่อความเป็นส่วนตัว
      </p>
    </div>
  );
};

export default PrivacyBlurOverlay;
