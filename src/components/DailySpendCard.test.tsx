import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { calculateDailySpendLimit } from '@/lib/dailySpendLimit';

vi.mock('@ionic/react', () => ({
  IonIcon: () => null,
}));
vi.mock('@/lib/privacyStore', () => ({
  usePrivacyMode: () => false,
  maskAmount: (value: string) => value,
}));

import DailySpendCard from '@/components/DailySpendCard';

const FIXED_NOW = new Date('2026-07-10T08:00:00Z');

describe('DailySpendCard', () => {
  it('shows a neutral setup state instead of a false 100% warning without planned income', () => {
    const daily = calculateDailySpendLimit(0, 0, 0, FIXED_NOW);

    render(<DailySpendCard daily={daily} />);

    expect(screen.getByText('ยังไม่ได้ตั้งงบรายรับเดือนนี้')).toBeInTheDocument();
    expect(screen.getByText(/เพิ่มรายรับที่คาดไว้ในหน้างบประมาณ/)).toBeInTheDocument();
    expect(screen.queryByText('100%')).not.toBeInTheDocument();
    expect(screen.queryByText('ใกล้เต็มงบประจำวัน')).not.toBeInTheDocument();
  });

  it('shows the calculated daily budget after planned income is available', () => {
    const daily = calculateDailySpendLimit(0, 0, 3000000, FIXED_NOW);

    render(<DailySpendCard daily={daily} />);

    expect(screen.getByText('งบประมาณที่ใช้ได้วันนี้')).toBeInTheDocument();
    expect(screen.getByText(/โควตาวันนี้/)).toBeInTheDocument();
    expect(screen.queryByText('ยังไม่ได้ตั้งงบรายรับเดือนนี้')).not.toBeInTheDocument();
  });
});
