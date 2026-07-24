import { IonIcon } from '@ionic/react';
import { pulseOutline, informationCircleOutline } from 'ionicons/icons';
import type { FinancialHealthResult } from '@/lib/financialHealthScore';

interface FinancialHealthCardProps {
  health: FinancialHealthResult;
}

export const FinancialHealthCard: React.FC<FinancialHealthCardProps> = ({ health }) => {
  return (
    <div
      className="tl-card"
      style={{
        background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
        border: '1px solid #e2e8f0',
        padding: 16,
        marginBottom: 16,
        borderRadius: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: 'rgba(79, 70, 229, 0.1)',
              color: health.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
            }}
          >
            <IonIcon icon={pulseOutline} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#0f172a' }}>คะแนนสุขภาพทางการเงิน</h3>
            <p style={{ margin: '1px 0 0', fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>
              ประเมินจากภาระหนี้ DTI และอัตราการออม
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '4px 12px',
            borderRadius: 999,
            background: health.color,
            color: '#ffffff',
            fontWeight: 900,
            fontSize: 15,
            boxShadow: `0 4px 12px ${health.color}40`,
          }}
        >
          {health.grade}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 14px', background: '#f1f5f9', borderRadius: 14 }}>
        <div style={{ textAlign: 'center', minWidth: 64 }}>
          <div style={{ fontSize: 26, fontWeight: 900, color: health.color, lineHeight: 1 }}>{health.score}</div>
          <div style={{ fontSize: 11, color: '#64748b', fontWeight: 700, marginTop: 2 }}>/ 100 คะแนน</div>
        </div>

        <div style={{ height: 36, width: 1, background: '#cbd5e1' }} />

        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>ภาระหนี้ต่อรายได้</div>
            <div style={{ fontSize: 14, fontWeight: 800, color: health.dtiPercent > 40 ? '#ef4444' : '#0f172a' }}>
              {health.dtiPercent}%
            </div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>สถานะสภาพคล่อง</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: health.color }}>
              {health.statusLabel}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12, fontSize: 12.5, color: '#334155', lineHeight: 1.4 }}>
        <IonIcon icon={informationCircleOutline} style={{ color: health.color, fontSize: 16, marginTop: 2, flexShrink: 0 }} />
        <span>{health.advice}</span>
      </div>
    </div>
  );
};

export default FinancialHealthCard;
