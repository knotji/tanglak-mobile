import React from 'react';

export interface MonthlyCashFlowPoint {
  monthLabel: string; // e.g. "ก.ค.", "มิ.ย."
  incomeSatang: number;
  expenseSatang: number;
}

interface CashFlowBarChartProps {
  data: MonthlyCashFlowPoint[];
}

export const CashFlowBarChart: React.FC<CashFlowBarChartProps> = ({ data }) => {
  if (data.length === 0) {
    return null;
  }

  const maxSatang = Math.max(1, ...data.map((d) => Math.max(d.incomeSatang, d.expenseSatang)));

  return (
    <div className="tl-card" style={{ padding: '20px 18px', marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ion-text-color)' }}>
          แนวโน้มกระแสเงินสด
        </p>
        <div style={{ display: 'flex', gap: 12, fontSize: 12, fontWeight: 600 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: '#10b981' }} />
            <span>รายรับ</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: '#ef4444' }} />
            <span>รายจ่าย</span>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-around', height: 130, gap: 12, paddingTop: 10 }}>
        {data.map((item, idx) => {
          const incomeHeight = Math.max(4, Math.round((item.incomeSatang / maxSatang) * 90));
          const expenseHeight = Math.max(4, Math.round((item.expenseSatang / maxSatang) * 90));

          return (
            <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 90 }}>
                {/* Income Bar */}
                <div
                  style={{
                    width: 12,
                    height: `${incomeHeight}px`,
                    borderRadius: '4px 4px 2px 2px',
                    background: 'linear-gradient(180deg, #34d399 0%, #10b981 100%)',
                    transition: 'height 0.4s ease',
                  }}
                  title={`รายรับ: ${(item.incomeSatang / 100).toLocaleString()} บาท`}
                />
                {/* Expense Bar */}
                <div
                  style={{
                    width: 12,
                    height: `${expenseHeight}px`,
                    borderRadius: '4px 4px 2px 2px',
                    background: 'linear-gradient(180deg, #f87171 0%, #ef4444 100%)',
                    transition: 'height 0.4s ease',
                  }}
                  title={`รายจ่าย: ${(item.expenseSatang / 100).toLocaleString()} บาท`}
                />
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--tl-text-secondary)' }}>
                {item.monthLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CashFlowBarChart;
