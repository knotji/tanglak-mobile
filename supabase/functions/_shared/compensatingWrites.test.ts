import { describe, expect, it, vi } from 'vitest';
import {
  CompensatingWriteError,
  deleteTransactionWithCompensation,
  type TransactionDeleteSnapshot,
  writeDebtPaymentWithCompensation,
} from './compensatingWrites';

describe('writeDebtPaymentWithCompensation', () => {
  it('completes all write steps in order', async () => {
    const calls: string[] = [];
    const transactionId = await writeDebtPaymentWithCompensation({
      insertTransaction: async () => {
        calls.push('insert transaction');
        return 'tx-1';
      },
      insertPayment: async (id) => {
        calls.push(`insert payment ${id}`);
      },
      recalculate: async () => {
        calls.push('recalculate');
      },
      deletePayment: vi.fn(),
      deleteTransaction: vi.fn(),
    });

    expect(transactionId).toBe('tx-1');
    expect(calls).toEqual(['insert transaction', 'insert payment tx-1', 'recalculate']);
  });

  it('deletes the transaction when the payment insert fails', async () => {
    const deletePayment = vi.fn();
    const deleteTransaction = vi.fn().mockResolvedValue(undefined);
    const recalculate = vi.fn().mockResolvedValue(undefined);

    await expect(writeDebtPaymentWithCompensation({
      insertTransaction: vi.fn().mockResolvedValue('tx-1'),
      insertPayment: vi.fn().mockRejectedValue(new Error('payment insert failed')),
      recalculate,
      deletePayment,
      deleteTransaction,
    })).rejects.toBeInstanceOf(CompensatingWriteError);

    expect(deletePayment).not.toHaveBeenCalled();
    expect(deleteTransaction).toHaveBeenCalledWith('tx-1');
    expect(recalculate).toHaveBeenCalledTimes(1);
  });

  it('removes both rows and restores the cached total when recalculation fails', async () => {
    const calls: string[] = [];
    let recalculateAttempt = 0;

    await expect(writeDebtPaymentWithCompensation({
      insertTransaction: vi.fn().mockResolvedValue('tx-1'),
      insertPayment: vi.fn().mockResolvedValue(undefined),
      recalculate: async () => {
        recalculateAttempt += 1;
        calls.push(`recalculate ${recalculateAttempt}`);
        if (recalculateAttempt === 1) throw new Error('recalculate failed');
      },
      deletePayment: async () => {
        calls.push('delete payment');
      },
      deleteTransaction: async () => {
        calls.push('delete transaction');
      },
    })).rejects.toBeInstanceOf(CompensatingWriteError);

    expect(calls).toEqual([
      'recalculate 1',
      'delete payment',
      'delete transaction',
      'recalculate 2',
    ]);
  });

  it('reports rollback failures without skipping later compensation', async () => {
    const deleteTransaction = vi.fn().mockResolvedValue(undefined);
    const recalculate = vi.fn()
      .mockRejectedValueOnce(new Error('initial recalculate failed'))
      .mockResolvedValueOnce(undefined);

    const error = await writeDebtPaymentWithCompensation({
      insertTransaction: vi.fn().mockResolvedValue('tx-1'),
      insertPayment: vi.fn().mockResolvedValue(undefined),
      recalculate,
      deletePayment: vi.fn().mockRejectedValue(new Error('payment rollback failed')),
      deleteTransaction,
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(CompensatingWriteError);
    expect((error as CompensatingWriteError).compensationErrors).toHaveLength(1);
    expect(deleteTransaction).toHaveBeenCalled();
    expect(recalculate).toHaveBeenCalledTimes(2);
  });
});

describe('deleteTransactionWithCompensation', () => {
  const snapshot: TransactionDeleteSnapshot = {
    transaction: { id: 'tx-1', debt_id: 'debt-1' },
    payment: { id: 'payment-1', transaction_id: 'tx-1' },
    debtId: 'debt-1',
  };

  it('deletes the linked payment before the transaction and recalculates', async () => {
    const calls: string[] = [];
    await deleteTransactionWithCompensation(snapshot, {
      deletePayment: async () => { calls.push('delete payment'); },
      deleteTransaction: async () => { calls.push('delete transaction'); },
      recalculate: async () => { calls.push('recalculate'); },
      restoreTransaction: vi.fn(),
      restorePayment: vi.fn(),
    });

    expect(calls).toEqual(['delete payment', 'delete transaction', 'recalculate']);
  });

  it('restores both records when recalculation fails', async () => {
    const calls: string[] = [];
    let recalculateAttempt = 0;

    await expect(deleteTransactionWithCompensation(snapshot, {
      deletePayment: async () => { calls.push('delete payment'); },
      deleteTransaction: async () => { calls.push('delete transaction'); },
      recalculate: async () => {
        recalculateAttempt += 1;
        calls.push(`recalculate ${recalculateAttempt}`);
        if (recalculateAttempt === 1) throw new Error('recalculate failed');
      },
      restoreTransaction: async () => { calls.push('restore transaction'); },
      restorePayment: async () => { calls.push('restore payment'); },
    })).rejects.toBeInstanceOf(CompensatingWriteError);

    expect(calls).toEqual([
      'delete payment',
      'delete transaction',
      'recalculate 1',
      'restore transaction',
      'restore payment',
      'recalculate 2',
    ]);
  });

  it('does not restore a transaction that was never deleted', async () => {
    const restoreTransaction = vi.fn();
    const restorePayment = vi.fn().mockResolvedValue(undefined);

    await expect(deleteTransactionWithCompensation(snapshot, {
      deletePayment: vi.fn().mockResolvedValue(undefined),
      deleteTransaction: vi.fn().mockRejectedValue(new Error('delete failed')),
      recalculate: vi.fn().mockResolvedValue(undefined),
      restoreTransaction,
      restorePayment,
    })).rejects.toBeInstanceOf(CompensatingWriteError);

    expect(restoreTransaction).not.toHaveBeenCalled();
    expect(restorePayment).toHaveBeenCalledWith(snapshot);
  });
});
