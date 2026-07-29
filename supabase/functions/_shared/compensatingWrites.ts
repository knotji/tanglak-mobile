export interface DebtPaymentWriteSteps {
  insertTransaction(): Promise<string>;
  insertPayment(transactionId: string): Promise<void>;
  recalculate(): Promise<void>;
  deletePayment(transactionId: string): Promise<void>;
  deleteTransaction(transactionId: string): Promise<void>;
}

export interface TransactionDeleteSnapshot {
  transaction: Record<string, unknown>;
  payment: Record<string, unknown> | null;
  debtId: string | null;
}

export interface TransactionDeleteSteps {
  deletePayment(snapshot: TransactionDeleteSnapshot): Promise<void>;
  deleteTransaction(snapshot: TransactionDeleteSnapshot): Promise<void>;
  recalculate(debtId: string): Promise<void>;
  restoreTransaction(snapshot: TransactionDeleteSnapshot): Promise<void>;
  restorePayment(snapshot: TransactionDeleteSnapshot): Promise<void>;
}

export class CompensatingWriteError extends Error {
  readonly cause: unknown;
  readonly compensationErrors: unknown[];

  constructor(message: string, cause: unknown, compensationErrors: unknown[]) {
    super(message);
    this.name = 'CompensatingWriteError';
    this.cause = cause;
    this.compensationErrors = compensationErrors;
  }
}

async function compensate(actions: Array<() => Promise<void>>): Promise<unknown[]> {
  const errors: unknown[] = [];
  for (const action of actions) {
    try {
      await action();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}

export async function writeDebtPaymentWithCompensation(
  steps: DebtPaymentWriteSteps,
): Promise<string> {
  const transactionId = await steps.insertTransaction();
  let paymentInserted = false;

  try {
    await steps.insertPayment(transactionId);
    paymentInserted = true;
    await steps.recalculate();
    return transactionId;
  } catch (error) {
    const compensationErrors = await compensate([
      ...(paymentInserted ? [() => steps.deletePayment(transactionId)] : []),
      () => steps.deleteTransaction(transactionId),
      () => steps.recalculate(),
    ]);
    throw new CompensatingWriteError(
      'Debt payment write failed and was rolled back',
      error,
      compensationErrors,
    );
  }
}

export async function deleteTransactionWithCompensation(
  snapshot: TransactionDeleteSnapshot,
  steps: TransactionDeleteSteps,
): Promise<void> {
  let paymentDeleted = false;
  let transactionDeleted = false;

  try {
    if (snapshot.payment) {
      await steps.deletePayment(snapshot);
      paymentDeleted = true;
    }
    await steps.deleteTransaction(snapshot);
    transactionDeleted = true;
    if (snapshot.debtId) await steps.recalculate(snapshot.debtId);
  } catch (error) {
    const compensationErrors = await compensate([
      ...(transactionDeleted ? [() => steps.restoreTransaction(snapshot)] : []),
      ...(paymentDeleted ? [() => steps.restorePayment(snapshot)] : []),
      ...(snapshot.debtId ? [() => steps.recalculate(snapshot.debtId)] : []),
    ]);
    throw new CompensatingWriteError(
      'Transaction delete failed and was rolled back',
      error,
      compensationErrors,
    );
  }
}
