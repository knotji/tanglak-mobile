import React from 'react';
import { IonSpinner } from '@ionic/react';
import BrandMark from '@/components/BrandMark';

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
        background: 'linear-gradient(145deg, #24324a 0%, #34395f 62%, #443f78 100%)',
        color: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px 20px',
        textAlign: 'center',
      }}
    >
      <div style={{ marginBottom: 24 }}><BrandMark size={90} inverted /></div>

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
        <IonSpinner name="crescent" style={{ color: '#9a8cff', width: 20, height: 20 }} />
        <span style={{ fontSize: 13, color: '#e2e8f0', fontWeight: 600 }}>{message}</span>
      </div>
    </div>
  );
};

export default AppSplashScreen;
