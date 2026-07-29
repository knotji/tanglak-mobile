import { IonIcon } from '@ionic/react';
import { walletOutline, alertCircleOutline } from 'ionicons/icons';
import type { DailySpendLimitResult } from '@/lib/dailySpendLimit';
import { usePrivacyMode, maskAmount } from '@/lib/privacyStore';
import { formatTHB } from '@/lib/money';

interface DailySpendCardProps {
  daily: DailySpendLimitResult;
}

export const DailySpendCard: React.FC<DailySpendCardProps> = ({ daily }) => {
  const isPrivacy = usePrivacyMode();

  if (!daily.hasPlannedIncome) {
    return (
      <div
        className="tl-card"
        style={{
          background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          borderColor: '#cbd5e1',
          padding: 16,
          marginBottom: 16,
          borderRadius: 18,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: '#e2e8f0',
            color: '#475569',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <IonIcon icon={walletOutline} />
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>
            ยังไม่ได้ตั้งงบรายรับเดือนนี้
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#64748b', fontWeight: 500, lineHeight: 1.45 }}>
            เพิ่มรายรับที่คาดไว้ในหน้างบประมาณ เพื่อคำนวณวงเงินที่ใช้ได้ต่อวัน
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="tl-card"
      style={{
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
        borderColor: '#c7d2fe',
        padding: 16,
        marginBottom: 16,
        borderRadius: 18,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 10,
              background: '#4f46e5',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            <IonIcon icon={walletOutline} />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 800, color: '#0f172a' }}>งบประมาณที่ใช้ได้วันนี้</h3>
            <p style={{ margin: '1px 0 0', fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>
              เหลืออีก {daily.daysRemainingInMonth} วันในเดือนนี้
            </p>
          </div>
        </div>

        <div
          style={{
            padding: '3px 10px',
            borderRadius: 999,
            background: `${daily.statusColor}18`,
            color: daily.statusColor,
            fontWeight: 700,
            fontSize: 12,
            border: `1px solid ${daily.statusColor}40`,
          }}
        >
          {daily.statusText}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 8 }}>
        <div>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>
            {daily.remainingTodaySatang >= 0 ? 'คงเหลือใช้ได้วันนี้' : 'ใช้เกินงบวันนี้ไป'}
          </span>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color: daily.remainingTodaySatang >= 0 ? '#0f172a' : '#ef4444',
              letterSpacing: '-0.02em',
              marginTop: 2,
            }}
          >
            {maskAmount(daily.formattedRemainingToday, isPrivacy)}
          </div>
        </div>

        <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b', fontWeight: 600 }}>
          โควตาวันนี้: <strong style={{ color: '#0f172a' }}>{maskAmount(daily.formattedDailyLimit, isPrivacy)}</strong>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ marginTop: 12 }}>
        <div style={{ width: '100%', height: 8, borderRadius: 999, background: '#cbd5e1', overflow: 'hidden' }}>
          <div
            style={{
              width: `${Math.min(100, daily.percentageUsedToday)}%`,
              height: '100%',
              borderRadius: 999,
              background: daily.statusColor,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>
          <span>ใช้ไปแล้ว {maskAmount(formatTHB(daily.todaySpentSatang), isPrivacy)}</span>
          <span>{daily.percentageUsedToday}%</span>
        </div>
      </div>

      {daily.remainingTodaySatang < 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12, color: '#ef4444', fontWeight: 600 }}>
          <IonIcon icon={alertCircleOutline} style={{ fontSize: 16 }} />
          <span>วันนี้ใช้เกินโควตา แนะนำประหยัดในวันถัดไปเพื่อดึงงบกลับมาครับ</span>
        </div>
      )}
    </div>
  );
};

export default DailySpendCard;
