import { useMemo, useState } from 'react';
import { IonIcon } from '@ionic/react';
import { trophyOutline, sparklesOutline, trendingDownOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import type { Debt } from '@/lib/debts';
import { buildDebtPortfolioComparison, filterActiveDebts } from '@/lib/debtPortfolioStrategy';
import { formatTHB } from '@/lib/money';

interface DebtFreedomWidgetProps {
  debts: Debt[];
}

const EXTRA_BUDGET_OPTIONS = [0, 500_00, 1000_00, 2000_00];

export const DebtFreedomWidget: React.FC<DebtFreedomWidgetProps> = ({ debts }) => {
  const history = useHistory();
  const [selectedExtraSatang, setSelectedExtraSatang] = useState(0);

  const activeDebts = useMemo(() => filterActiveDebts(debts), [debts]);
  // Both run a full N-debt amortization simulation -- memoized so an
  // unrelated parent re-render (e.g. toggling privacy mode) doesn't
  // recompute them; only a real change to the debt list or the selected
  // extra-budget chip does.
  const baseComparison = useMemo(() => (activeDebts.length > 0 ? buildDebtPortfolioComparison(activeDebts, 0) : null), [activeDebts]);
  const extraComparison = useMemo(
    () => (activeDebts.length > 0 ? buildDebtPortfolioComparison(activeDebts, selectedExtraSatang) : null),
    [activeDebts, selectedExtraSatang],
  );

  if (activeDebts.length === 0 || !baseComparison || !extraComparison) {
    return (
      <div
        className="tl-card"
        style={{
          background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
          borderColor: '#a7f3d0',
          padding: 16,
          marginBottom: 16,
          display: 'flex',
          alignItems: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 14,
            background: '#10b981',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 24,
          }}
        >
          <IonIcon icon={trophyOutline} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#065f46' }}>คุณไม่มีหนี้สินคงค้างแล้ว! 🎉</p>
          <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#047857', fontWeight: 500 }}>
            คุณเป็นอิสระทางการเงิน 100% รักษาพฤติกรรมออมเงินแบบนี้ต่อไปครับ
          </p>
        </div>
      </div>
    );
  }

  // Base simulation without extra budget
  const baseStrategy = baseComparison.avalanche;

  // Maximum remaining months among all active debts
  let maxBaseMonths = 0;
  let latestBasePayoffDate = '';

  for (const sim of baseStrategy.simulations) {
    const rem = sim.estimatedInstallmentsRemaining ?? 0;
    if (rem > maxBaseMonths) {
      maxBaseMonths = rem;
      if (sim.estimatedPayoffDate) latestBasePayoffDate = sim.estimatedPayoffDate;
    }
  }

  // Accelerated simulation with selected extra budget
  const extraStrategy = extraComparison.avalanche;
  let maxExtraMonths = 0;
  let latestExtraPayoffDate = latestBasePayoffDate;

  for (const sim of extraStrategy.simulations) {
    const rem = sim.estimatedInstallmentsRemaining ?? 0;
    if (rem > maxExtraMonths) {
      maxExtraMonths = rem;
      if (sim.estimatedPayoffDate) latestExtraPayoffDate = sim.estimatedPayoffDate;
    }
  }

  const monthsSaved = Math.max(0, maxBaseMonths - maxExtraMonths);
  const interestSavedSatang = Math.max(0, baseStrategy.totalEstimatedRemainingInterestSatang - extraStrategy.totalEstimatedRemainingInterestSatang);

  const totalOutstandingSatang = activeDebts.reduce((sum, d) => sum + (d.outstandingBalanceSatang ?? 0), 0);

  return (
    <div
      className="tl-card"
      style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
        color: '#ffffff',
        padding: '18px 18px 16px',
        borderRadius: 20,
        marginBottom: 16,
        boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.4)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: -30,
          right: -30,
          width: 120,
          height: 120,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.25) 0%, rgba(0,0,0,0) 70%)',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <IonIcon icon={sparklesOutline} style={{ color: '#818cf8', fontSize: 18 }} />
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', color: '#c7d2fe', textTransform: 'uppercase' }}>
            เป้าหมายอิสรภาพทางการเงิน
          </span>
        </div>
        <button
          type="button"
          onClick={() => history.push('/debts/strategy')}
          style={{ background: 'none', border: 'none', padding: 0, color: '#a5b4fc', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
        >
          ดูแผนชำระ →
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 32, fontWeight: 900, color: '#ffffff', letterSpacing: '-0.02em' }}>
          {maxExtraMonths > 0 ? `${maxExtraMonths} เดือน` : 'เร็ว ๆ นี้'}
        </span>
        <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500 }}>
          ({latestExtraPayoffDate ? `หมดหนี้ช่วง ${latestExtraPayoffDate}` : 'อยู่ระหว่างคำนวณ'})
        </span>
      </div>

      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 14, fontSize: 12.5, color: '#cbd5e1' }}>
        <div>ยอดหนี้คงเหลือรวม: <strong style={{ color: '#ffffff' }}>{formatTHB(totalOutstandingSatang)}</strong></div>
        <div>จำนวน: <strong style={{ color: '#ffffff' }}>{activeDebts.length} ก้อน</strong></div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '14px 0 12px' }} />

      <div style={{ fontSize: 12, color: '#a5b4fc', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}>
        <IonIcon icon={trendingDownOutline} />
        <span>ลองจำลองเพิ่มเงินโปะหนี้ต่อเดือน:</span>
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {EXTRA_BUDGET_OPTIONS.map((satang) => {
          const isSelected = selectedExtraSatang === satang;
          return (
            <button
              key={satang}
              type="button"
              onClick={() => setSelectedExtraSatang(satang)}
              style={{
                flex: '0 0 auto',
                padding: '6px 12px',
                borderRadius: 999,
                border: '1px solid',
                borderColor: isSelected ? '#818cf8' : 'rgba(255,255,255,0.15)',
                background: isSelected ? '#4f46e5' : 'rgba(255,255,255,0.05)',
                color: isSelected ? '#ffffff' : '#cbd5e1',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {satang === 0 ? 'จ่ายขั้นต่ำ' : `+${formatTHB(satang)}`}
            </button>
          );
        })}
      </div>

      {selectedExtraSatang > 0 && (
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 12,
            background: 'rgba(99, 102, 241, 0.2)',
            border: '1px solid rgba(129, 140, 248, 0.4)',
            fontSize: 12.5,
            color: '#e0e7ff',
            lineHeight: 1.4,
          }}
        >
          ✨ ถ้าโปะเพิ่ม <strong>{formatTHB(selectedExtraSatang)}/เดือน</strong> จะหมดหนี้เร็วขึ้น{' '}
          <strong style={{ color: '#38bdf8' }}>{monthsSaved} เดือน</strong> และประหยัดดอกเบี้ยได้ถึง{' '}
          <strong style={{ color: '#4ade80' }}>{formatTHB(interestSavedSatang)}</strong>!
        </div>
      )}
    </div>
  );
};

export default DebtFreedomWidget;
