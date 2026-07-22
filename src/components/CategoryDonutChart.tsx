import React from 'react';
import { formatTHB } from '@/lib/money';

export interface CategoryDonutItem {
  label: string;
  amountSatang: number;
  color: string;
}

interface CategoryDonutChartProps {
  items: CategoryDonutItem[];
  totalSatang: number;
}

export const CategoryDonutChart: React.FC<CategoryDonutChartProps> = ({ items, totalSatang }) => {
  if (totalSatang <= 0 || items.length === 0) {
    return (
      <div className="tl-card tl-empty" style={{ padding: 20 }}>
        <p style={{ margin: 0, fontSize: 13 }}>ไม่มีข้อมูลรายจ่ายในเดือนนี้</p>
      </div>
    );
  }

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let accumulatedPercent = 0;

  const segments = items.map((item) => {
    const percent = item.amountSatang / totalSatang;
    const strokeDasharray = `${percent * circumference} ${circumference}`;
    const strokeDashoffset = -(accumulatedPercent * circumference);
    accumulatedPercent += percent;

    return {
      ...item,
      percent: Math.round(percent * 100),
      strokeDasharray,
      strokeDashoffset,
    };
  });

  return (
    <div className="tl-card" style={{ padding: '20px 18px' }}>
      <p style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 700, color: 'var(--ion-text-color)' }}>
        สัดส่วนรายจ่ายตามหมวดหมู่
      </p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20, flexWrap: 'wrap' }}>
        {/* SVG Donut */}
        <div style={{ position: 'relative', width: 140, height: 140, flexShrink: 0 }}>
          <svg width="140" height="140" viewBox="0 0 140 140" style={{ transform: 'rotate(-90deg)', overflow: 'visible' }}>
            <circle cx="70" cy="70" r={radius} fill="none" stroke="#f1f5f9" strokeWidth="18" />
            {segments.map((seg, idx) => (
              <circle
                key={idx}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={seg.color}
                strokeWidth="18"
                strokeDasharray={seg.strokeDasharray}
                strokeDashoffset={seg.strokeDashoffset}
                strokeLinecap="butt"
                style={{ transition: 'all 0.5s ease' }}
              />
            ))}
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 11, color: 'var(--tl-text-secondary)', fontWeight: 600 }}>รายจ่ายรวม</span>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--ion-text-color)', fontVariantNumeric: 'tabular-nums' }}>
              {formatTHB(totalSatang)}
            </span>
          </div>
        </div>

        {/* Category Legend List */}
        <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {segments.slice(0, 5).map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color, flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: 'var(--ion-text-color)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.label}
                </span>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: 8 }}>
                <span style={{ fontWeight: 700, color: 'var(--ion-text-color)', fontVariantNumeric: 'tabular-nums' }}>
                  {item.percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryDonutChart;
