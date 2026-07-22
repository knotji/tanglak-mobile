import { IonIcon } from '@ionic/react';
import { alertCircleOutline, calendarClearOutline, checkmarkCircleOutline, chevronForwardOutline } from 'ionicons/icons';
import {
  DEBT_DUE_STATUS_LABEL_TH,
  debtDueStatus,
  formatInterestRateSummary,
  paymentProgress,
  remainingToMinimum,
  type Debt,
} from '@/lib/debts';
import { formatTHB } from '@/lib/money';
import { formatThaiDateLabel } from '@/lib/date';

const STATUS_ICON = {
  not_yet_due: calendarClearOutline,
  due_soon: calendarClearOutline,
  due_today: alertCircleOutline,
  overdue: alertCircleOutline,
  minimum_paid: checkmarkCircleOutline,
  cycle_paid_in_full: checkmarkCircleOutline,
} as const;

const STATUS_TONE = {
  not_yet_due: { bg: '#f1f5f9', fg: '#64748b' },
  due_soon: { bg: '#fef3c7', fg: '#b45309' },
  due_today: { bg: '#fee2e2', fg: '#dc2626' },
  overdue: { bg: '#fee2e2', fg: '#dc2626' },
  minimum_paid: { bg: '#d1fae5', fg: '#047857' },
  cycle_paid_in_full: { bg: '#d1fae5', fg: '#047857' },
} as const;

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div style={{ background: 'var(--tl-primary-soft)', padding: '10px 12px', borderRadius: 'var(--tl-radius-sm)' }}>
    <p style={{ margin: 0, fontSize: 11.5, color: 'var(--tl-text-secondary)', fontWeight: 600 }}>{label}</p>
    <p style={{ margin: '3px 0 0', fontSize: 16, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--ion-text-color)' }}>{children}</p>
  </div>
);

const DebtCard: React.FC<{ debt: Debt }> = ({ debt }) => {
  const status = debtDueStatus(debt);
  const progress = Math.min(100, Math.max(0, paymentProgress(debt) * 100));
  const remaining = remainingToMinimum(debt);
  const tone = STATUS_TONE[status];

  return (
    <article className="tl-card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, minWidth: 0, overflowWrap: 'break-word', color: 'var(--ion-text-color)' }}>{debt.name}</h2>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 5,
              borderRadius: 999,
              padding: '4px 10px',
              fontSize: 12,
              fontWeight: 700,
              background: tone.bg,
              color: tone.fg,
              whiteSpace: 'nowrap',
            }}
          >
            <IonIcon icon={STATUS_ICON[status]} style={{ fontSize: 14 }} />
            {DEBT_DUE_STATUS_LABEL_TH[status]}
          </span>
          <IonIcon icon={chevronForwardOutline} style={{ fontSize: 16, color: '#94a3b8', opacity: 0.7 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 16 }}>
        <Stat label="ยอดคงเหลือ">{formatTHB(debt.outstandingBalanceSatang ?? 0)}</Stat>
        <Stat label="ยอดเรียกเก็บรอบนี้">{formatTHB(debt.amountDueSatang ?? 0)}</Stat>
        <Stat label="ขั้นต่ำเดือนนี้">{formatTHB(debt.minimumPaymentSatang ?? 0)}</Stat>
        <Stat label="ครบกำหนด">{debt.dueDate ? (formatThaiDateLabel(debt.dueDate) ?? debt.dueDate) : 'ยังไม่ระบุ'}</Stat>
      </div>

      {debt.interestRateAnnual !== null && (
        <p style={{ marginTop: 12, fontSize: 12, color: 'var(--tl-text-secondary)', fontWeight: 500 }}>
          {formatInterestRateSummary(debt.interestRateAnnual)}
        </p>
      )}

      <div style={{ marginTop: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}>
          <span style={{ color: 'var(--tl-text-secondary)', fontWeight: 600 }}>ชำระแล้วรอบนี้</span>
          <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
            {formatTHB(debt.amountPaidThisCycleSatang)} จาก {formatTHB(debt.minimumPaymentSatang ?? 0)}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--tl-muted)', overflow: 'hidden' }}>
          <div
            style={{
              height: '100%',
              width: `${progress}%`,
              background: progress >= 100 ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' : 'linear-gradient(90deg, #f59e0b 0%, #d97706 100%)',
              borderRadius: 999,
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {remaining > 0 && (
        <p style={{ marginTop: 12, fontSize: 13, fontWeight: 700, color: 'var(--tl-debt)' }}>
          ยังขาดขั้นต่ำ {formatTHB(remaining)}
        </p>
      )}
    </article>
  );
};

export default DebtCard;
