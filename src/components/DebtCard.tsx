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

const STATUS_ICON = {
  not_yet_due: calendarClearOutline,
  due_soon: calendarClearOutline,
  due_today: alertCircleOutline,
  overdue: alertCircleOutline,
  minimum_paid: checkmarkCircleOutline,
  cycle_paid_in_full: checkmarkCircleOutline,
} as const;

const STATUS_TONE = {
  not_yet_due: { bg: 'var(--tl-muted)', fg: 'var(--tl-text-secondary)' },
  due_soon: { bg: 'var(--next-soft, #FBF0DD)', fg: 'var(--tl-debt)' },
  due_today: { bg: '#FBE9E7', fg: 'var(--tl-overdue)' },
  overdue: { bg: '#FBE9E7', fg: 'var(--tl-overdue)' },
  minimum_paid: { bg: '#E3F2EA', fg: 'var(--tl-income)' },
  cycle_paid_in_full: { bg: '#E3F2EA', fg: 'var(--tl-income)' },
} as const;

const Stat: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <p style={{ margin: 0, fontSize: 12, color: 'var(--tl-text-secondary)' }}>{label}</p>
    <p style={{ margin: '2px 0 0', fontSize: 18, fontWeight: 700 }}>{children}</p>
  </div>
);

const DebtCard: React.FC<{ debt: Debt }> = ({ debt }) => {
  const status = debtDueStatus(debt);
  const progress = paymentProgress(debt) * 100;
  const remaining = remainingToMinimum(debt);
  const tone = STATUS_TONE[status];

  return (
    <article className="tl-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, minWidth: 0, overflowWrap: 'break-word' }}>{debt.name}</h2>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              borderRadius: 14,
              padding: '5px 10px',
              fontSize: 11.5,
              fontWeight: 700,
              background: tone.bg,
              color: tone.fg,
              whiteSpace: 'nowrap',
            }}
          >
            <IonIcon icon={STATUS_ICON[status]} style={{ fontSize: 14 }} />
            {DEBT_DUE_STATUS_LABEL_TH[status]}
          </span>
          <IonIcon icon={chevronForwardOutline} color="medium" style={{ fontSize: 16, opacity: 0.6 }} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 18 }}>
        <Stat label="ยอดคงเหลือ">{formatTHB(debt.outstandingBalanceSatang ?? 0)}</Stat>
        <Stat label="ยอดเรียกเก็บรอบนี้">{formatTHB(debt.amountDueSatang ?? 0)}</Stat>
        <Stat label="ขั้นต่ำเดือนนี้">{formatTHB(debt.minimumPaymentSatang ?? 0)}</Stat>
        <Stat label="ครบกำหนด">{debt.dueDate ?? 'ยังไม่ระบุ'}</Stat>
      </div>

      {debt.interestRateAnnual !== null && (
        <p style={{ marginTop: 10, fontSize: 12, color: 'var(--tl-text-secondary)' }}>
          {formatInterestRateSummary(debt.interestRateAnnual)}
        </p>
      )}

      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
          <span style={{ color: 'var(--tl-text-secondary)', fontWeight: 600 }}>จ่ายแล้วรอบนี้</span>
          <span style={{ fontWeight: 700 }}>
            {formatTHB(debt.amountPaidThisCycleSatang)} จาก {formatTHB(debt.minimumPaymentSatang ?? 0)}
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'var(--tl-muted)', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--tl-debt)', borderRadius: 999 }} />
        </div>
      </div>

      {remaining > 0 && (
        <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: 'var(--tl-debt)' }}>
          ยังขาดขั้นต่ำ {formatTHB(remaining)}
        </p>
      )}
    </article>
  );
};

export default DebtCard;
