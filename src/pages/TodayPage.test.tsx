import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { OverviewSnapshot } from '@/lib/overview';
import type { Transaction } from '@/lib/transactions';

const mocks = vi.hoisted(() => ({
  enterCallbacks: [] as Array<() => void>,
  listTodayTransactions: vi.fn(),
  getOverviewSnapshot: vi.fn(),
}));

vi.mock('@ionic/react', () => ({
  IonContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonIcon: () => null,
  IonPage: ({ children }: { children: ReactNode }) => <main>{children}</main>,
  IonRefresher: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  IonRefresherContent: () => null,
  IonSpinner: () => <span data-testid="spinner">loading</span>,
  IonText: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  useIonRouter: () => ({ push: vi.fn() }),
  useIonViewWillEnter: (callback: () => void) => {
    mocks.enterCallbacks.push(callback);
  },
}));
vi.mock('@/components/PageHeader', () => ({
  default: ({ title }: { title: string }) => <h1>{title}</h1>,
}));
vi.mock('@/components/TransactionList', () => ({
  default: () => <div data-testid="transaction-list" />,
}));
vi.mock('@/components/DailySpendCard', () => ({
  default: () => <div data-testid="daily-spend-card" />,
}));
vi.mock('@/lib/transactions', () => ({
  listTodayTransactions: mocks.listTodayTransactions,
}));
vi.mock('@/lib/overview', () => ({
  getOverviewSnapshot: mocks.getOverviewSnapshot,
}));
vi.mock('@/lib/privacyStore', () => ({
  usePrivacyMode: () => false,
  maskAmount: (value: string) => value,
}));

import TodayPage from '@/pages/TodayPage';

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const transaction: Transaction = {
  id: 'tx-today',
  type: 'expense',
  amountSatang: 12500,
  occurredAt: '2026-07-29T01:00:00.000Z',
  merchant: 'ร้านทดสอบ',
  categoryLabel: 'อาหาร',
  paymentMethod: null,
  note: null,
};

const snapshot: OverviewSnapshot = {
  totals: {
    incomeSatang: 0,
    livingExpenseSatang: 12500,
    debtPaymentSatang: 0,
    refundSatang: 0,
  },
  plannedIncomeSatang: 3000000,
  cashRemainingSatang: 2987500,
  totalOutstandingSatang: 1000000,
  totalMinimumDueSatang: 100000,
  debtCount: 1,
};

describe('TodayPage loading states', () => {
  beforeEach(() => {
    mocks.enterCallbacks.length = 0;
    mocks.listTodayTransactions.mockReset();
    mocks.getOverviewSnapshot.mockReset();
  });

  it('reveals independently loaded sections without displaying zero-value fallbacks', async () => {
    const transactionsRequest = deferred<Transaction[]>();
    const snapshotRequest = deferred<OverviewSnapshot>();
    mocks.listTodayTransactions.mockReturnValue(transactionsRequest.promise);
    mocks.getOverviewSnapshot.mockReturnValue(snapshotRequest.promise);

    render(<TodayPage />);
    act(() => mocks.enterCallbacks[0]());

    expect(screen.getByText('กำลังคำนวณงบที่ใช้ได้วันนี้…')).toBeInTheDocument();
    expect(screen.queryByTestId('daily-spend-card')).not.toBeInTheDocument();

    transactionsRequest.resolve([transaction]);
    await screen.findByText('รายจ่ายวันนี้');
    expect(screen.queryByTestId('daily-spend-card')).not.toBeInTheDocument();

    snapshotRequest.resolve(snapshot);
    expect(await screen.findByTestId('daily-spend-card')).toBeInTheDocument();
  });

  it('shows section-specific errors and never renders fabricated financial cards', async () => {
    mocks.listTodayTransactions.mockRejectedValue(new Error('โหลดธุรกรรมไม่ได้'));
    mocks.getOverviewSnapshot.mockRejectedValue(new Error('โหลดภาพรวมไม่ได้'));

    render(<TodayPage />);
    act(() => mocks.enterCallbacks[0]());

    await waitFor(() => {
      expect(screen.getByText('โหลดธุรกรรมไม่ได้')).toBeInTheDocument();
      expect(screen.getByText(/คำนวณงบที่ใช้ได้วันนี้ไม่สำเร็จ/)).toBeInTheDocument();
    });

    expect(screen.queryByTestId('daily-spend-card')).not.toBeInTheDocument();
  });
});
