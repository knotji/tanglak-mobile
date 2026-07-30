import React, { useEffect, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { fingerPrintOutline, lockClosedOutline, shieldCheckmarkOutline } from 'ionicons/icons';
import { isBiometricLockEnabled, authenticateBiometrics } from '@/lib/biometrics';

interface BiometricLockGuardProps {
  children: React.ReactNode;
}

export const BiometricLockGuard: React.FC<BiometricLockGuardProps> = ({ children }) => {
  const [isLocked, setIsLocked] = useState(() => isBiometricLockEnabled());
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState('');
  const [isAppActive, setIsAppActive] = useState(true);

  const triggerUnlock = async () => {
    setError('');
    setAuthenticating(true);
    try {
      const success = await authenticateBiometrics('ยืนยันตัวตนเพื่อเข้าใช้งานแอปตั้งหลัก');
      if (success) {
        setIsLocked(false);
      } else {
        setError('การยืนยันตัวตนไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการยืนยันตัวตน');
    } finally {
      setAuthenticating(false);
    }
  };

  useEffect(() => {
    if (isLocked && isAppActive) {
      void triggerUnlock();
    }
  }, [isLocked, isAppActive]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    void App.addListener('appStateChange', ({ isActive }) => {
      setIsAppActive(isActive);
      if (!isActive && isBiometricLockEnabled()) setIsLocked(true);
    }).then((handle) => {
      if (cancelled) handle.remove();
      else subscription = handle;
    });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'linear-gradient(145deg, #24324a 0%, #443f78 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        textAlign: 'center',
      }}
    >
      {/* Brand & Security Emblem */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: 24,
          background: 'linear-gradient(135deg, #6558d3 0%, #443f78 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 30px -5px rgba(79, 70, 229, 0.5)',
          marginBottom: 24,
        }}
      >
        <IonIcon aria-hidden="true" icon={shieldCheckmarkOutline} style={{ fontSize: 42, color: '#ffffff' }} />
      </div>

      <h2 style={{ fontSize: 26, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>ตั้งหลัก</h2>
      <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 6, marginBottom: 32, fontWeight: 500 }}>
        ความปลอดภัยสูงสุด · แอปถูกล็อกอยู่
      </p>

      <div
        style={{
          background: 'rgba(255, 255, 255, 0.06)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 24,
          padding: '24px 20px',
          maxWidth: 340,
          width: '100%',
        }}
      >
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: 'rgba(79, 70, 229, 0.2)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#818cf8',
            marginBottom: 14,
          }}
        >
          <IonIcon aria-hidden="true" icon={lockClosedOutline} style={{ fontSize: 26 }} />
        </div>

        <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 6px' }}>สแกนเพื่อเข้าใช้งาน</p>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
          กรุณาสแกน Face ID หรือลายนิ้วมือเพื่อยืนยันตัวตน
        </p>

        {error && (
          <p style={{ fontSize: 13, color: '#f87171', marginTop: 12, marginBottom: 0, fontWeight: 600 }}>{error}</p>
        )}

        <IonButton
          expand="block"
          disabled={authenticating}
          onClick={() => void triggerUnlock()}
          style={{
            marginTop: 20,
            '--border-radius': '999px',
            '--background': 'linear-gradient(135deg, #6558d3 0%, #443f78 100%)',
            '--box-shadow': '0 8px 20px -4px rgba(79, 70, 229, 0.4)',
            fontWeight: 700,
            fontSize: 15,
            minHeight: 50,
          }}
        >
          {authenticating ? (
            <IonSpinner name="dots" />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <IonIcon aria-hidden="true" icon={fingerPrintOutline} style={{ fontSize: 20 }} />
              <span>สแกนเพื่อปลดล็อก</span>
            </div>
          )}
        </IonButton>
      </div>
    </div>
  );
};

export default BiometricLockGuard;
