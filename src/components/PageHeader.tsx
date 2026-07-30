import { IonIcon } from '@ionic/react';
import { eyeOutline, eyeOffOutline } from 'ionicons/icons';
import { usePrivacyMode, togglePrivacyMode } from '@/lib/privacyStore';

const PageHeader: React.FC<{ title: string; subtitle?: string }> = ({ title, subtitle }) => {
  const isPrivacy = usePrivacyMode();

  return (
    <header className="tl-page-header">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="tl-brand">ตั้งหลัก</p>
        <button
          type="button"
          onClick={() => togglePrivacyMode()}
          aria-label={isPrivacy ? 'แสดงตัวเลข' : 'ซ่อนตัวเลข'}
          className="tl-privacy-button"
          style={{
            borderRadius: 999,
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 600,
            color: isPrivacy ? '#6558d3' : '#687083',
            cursor: 'pointer',
          }}
        >
          <IonIcon icon={isPrivacy ? eyeOffOutline : eyeOutline} style={{ fontSize: 16 }} />
          <span>{isPrivacy ? 'ซ่อนยอดเงิน' : 'แสดงยอดเงิน'}</span>
        </button>
      </div>
      <h1>{title}</h1>
      {subtitle && <p className="tl-subtitle">{subtitle}</p>}
    </header>
  );
};

export default PageHeader;
