import React from 'react';
import { IonIcon, IonSpinner } from '@ionic/react';
import { walletOutline } from 'ionicons/icons';

interface AppSplashScreenProps {
  message?: string;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({ message = 'กำลังโหลดแอปพลิเคชัน…' }) => {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        textAlign: 'center',
      }}
    >
      {/* Glowing Brand Emblem */}
      <div
        style={{
          position: 'relative',
          width: 90,
          height: 90,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: -8,
            borderRadius: 32,
            background: 'linear-gradient(135deg, #4f46e5 0%, #10b981 100%)',
            opacity: 0.35,
            filter: 'blur(16px)',
            animation: 'pulse 2s infinite alternate',
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 90,
            height: 90,
            borderRadius: 28,
            background: 'linear-gradient(135deg, #0f172a 0%, #312e81 100%)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px -5px rgba(79, 70, 229, 0.5)',
          }}
        >
          <IonIcon icon={walletOutline} style={{ fontSize: 44, color: '#818cf8' }} />
        </div>
      </div>

      <h1
        style={{
          fontSize: 34,
          fontWeight: 800,
          margin: 0,
          letterSpacing: '-0.02em',
          background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        ตั้งหลัก
      </h1>

      <p style={{ fontSize: 14, color: '#94a3b8', marginTop: 8, marginBottom: 40, fontWeight: 500 }}>
        เห็นเงินเข้าออกชัด วางแผนชีวิตได้ง่ายขึ้น
      </p>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255, 255, 255, 0.08)', padding: '8px 18px', borderRadius: 999 }}>
        <IonSpinner name="crescent" style={{ color: '#818cf8', width: 20, height: 20 }} />
        <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{message}</span>
      </div>
    </div>
  );
};

export default AppSplashScreen;
