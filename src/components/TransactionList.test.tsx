import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Transaction } from '@/lib/transactions';

const { deleteTransaction, push } = vi.hoisted(() => ({
  deleteTransaction: vi.fn(),
  push: vi.fn(),
}));

vi.mock('@/lib/saveTransaction', () => ({ deleteTransaction }));
vi.mock('react-router-dom', () => ({
  useHistory: () => ({ push }),
}));
vi.mock('@ionic/react', () => ({
  IonIcon: () => null,
  IonActionSheet: ({
    isOpen,
    buttons,
  }: {
    isOpen: boolean;
    buttons: Array<{ text: string; handler?: () => void }>;
  }) => isOpen ? (
    <div data-testid="action-sheet">
      {buttons.map((button) => (
        <button key={button.text} type="button" onClick={button.handler}>
          {button.text}
        </button>
      ))}
    </div>
  ) : null,
  IonAlert: ({
    isOpen,
    header,
    buttons,
  }: {
    isOpen: boolean;
    header: string;
    buttons: Array<{ text: string; handler?: () => void }>;
  }) => isOpen ? (
    <div role="alertdialog" aria-label={header}>
      {buttons.map((button) => (
        <button key={button.text} type="button" onClick={button.handler}>
          {button.text}
        </button>
      ))}
    </div>
  ) : null,
  IonToast: ({
    isOpen,
    message,
  }: {
    isOpen: boolean;
    message: string;
  }) => isOpen ? <div role="alert">{message}</div> : null,
}));

import TransactionList from '@/components/TransactionList';

const expense: Transaction = {
  id: 'tx-expense',
  type: 'expense',
  amountSatang: 12500,
  occurredAt: '2026-07-29T01:00:00.000Z',
  merchant: 'ร้านทดสอบ',
  categoryLabel: 'อาหาร',
  paymentMethod: null,
  note: null,
};

const debtPayment: Transaction = {
  ...expense,
  id: 'tx-debt',
  type: 'debt_payment',
  merchant: 'ชำระบัตรเครดิต',
};

describe('TransactionList critical actions', () => {
  beforeEach(() => {
    deleteTransaction.mockReset();
    push.mockReset();
  });

  function renderList(
    transactions: Transaction[],
    onDeleted = vi.fn(),
  ): { onDeleted: ReturnType<typeof vi.fn> } {
    render(<TransactionList transactions={transactions} onDeleted={onDeleted} />);
    return { onDeleted };
  }

  it('requires destructive confirmation before deleting and updates the caller only after success', async () => {
    deleteTransaction.mockResolvedValue(undefined);
    const { onDeleted } = renderList([expense]);

    fireEvent.click(screen.getByRole('button', { name: /ร้านทดสอบ/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ลบรายการนี้' }));

    expect(deleteTransaction).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'ลบรายการนี้?' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'ลบ' }));

    await waitFor(() => {
      expect(deleteTransaction).toHaveBeenCalledWith('tx-expense');
      expect(onDeleted).toHaveBeenCalledWith('tx-expense');
    });
  });

  it('keeps the row in caller state and displays the backend error when deletion fails', async () => {
    deleteTransaction.mockRejectedValue(new Error('ยอดหนี้ปรับปรุงไม่สำเร็จ'));
    const { onDeleted } = renderList([expense]);

    fireEvent.click(screen.getByRole('button', { name: /ร้านทดสอบ/ }));
    fireEvent.click(screen.getByRole('button', { name: 'ลบรายการนี้' }));
    fireEvent.click(screen.getByRole('button', { name: 'ลบ' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('ยอดหนี้ปรับปรุงไม่สำเร็จ');
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it('does not offer edit for a debt payment', () => {
    renderList([debtPayment]);

    fireEvent.click(screen.getByRole('button', { name: /ชำระบัตรเครดิต/ }));

    expect(screen.queryByRole('button', { name: 'แก้ไข' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ลบรายการนี้' })).toBeInTheDocument();
  });

  it('routes a regular transaction to its edit screen', () => {
    renderList([expense]);

    fireEvent.click(screen.getByRole('button', { name: /ร้านทดสอบ/ }));
    fireEvent.click(screen.getByRole('button', { name: 'แก้ไข' }));

    expect(push).toHaveBeenCalledWith('/transactions/tx-expense/edit');
  });
});
