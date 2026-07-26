// Pure calculations, ported from tanglak/src/lib/finance/{calculations,debt-status,debt-interest}.ts.
// No Supabase, no side effects -- kept separate from debts.ts (CRUD/reads)
// and debtCycle.ts (cycle-advance writes) so this file's logic can be read
// and tested in isolation from anything that talks to the network.
import type { Debt } from '@/lib/debts';

export function remainingToMinimum(debt: Debt): number {
  return Math.max(0, (debt.minimumPaymentSatang ?? 0) - debt.amountPaidThisCycleSatang);
}

export function paymentProgress(debt: Debt): number {
  const target = debt.minimumPaymentSatang ?? debt.amountDueSatang ?? 0;
  if (target <= 0) return 1;
  return Math.min(1, debt.amountPaidThisCycleSatang / target);
}

function getBangkokTodayString(date: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')!.value;
  const month = parts.find((p) => p.type === 'month')!.value;
  const day = parts.find((p) => p.type === 'day')!.value;
  return `${year}-${month}-${day}`;
}

export function daysUntilDue(dueDate: string, today = new Date()): number {
  const [todayYear, todayMonth, todayDay] = getBangkokTodayString(today).split('-').map(Number);
  const start = Date.UTC(todayYear, todayMonth - 1, todayDay);
  const [year, month, day] = dueDate.split('-').map(Number);
  const due = Date.UTC(year, month - 1, day);
  return Math.ceil((due - start) / 86_400_000);
}

export type DebtDueStatus = 'not_yet_due' | 'due_soon' | 'due_today' | 'overdue' | 'minimum_paid' | 'cycle_paid_in_full';

export const DEBT_DUE_STATUS_LABEL_TH: Record<DebtDueStatus, string> = {
  not_yet_due: 'ยังไม่ถึงกำหนด',
  due_soon: 'ใกล้ครบกำหนด',
  due_today: 'ครบกำหนดวันนี้',
  overdue: 'เกินกำหนด',
  minimum_paid: 'จ่ายขั้นต่ำแล้ว',
  cycle_paid_in_full: 'จ่ายครบยอดรอบนี้แล้ว',
};

const DEBT_DUE_SOON_WINDOW_DAYS = 3;

export function debtDueStatus(debt: Debt, today: Date = new Date()): DebtDueStatus {
  const paid = debt.amountPaidThisCycleSatang;
  if (debt.amountDueSatang !== null && debt.amountDueSatang !== undefined && debt.amountDueSatang > 0 && paid >= debt.amountDueSatang) {
    return 'cycle_paid_in_full';
  }
  if (debt.minimumPaymentSatang !== null && debt.minimumPaymentSatang !== undefined && debt.minimumPaymentSatang > 0 && paid >= debt.minimumPaymentSatang) {
    return 'minimum_paid';
  }
  if (!debt.dueDate) return 'not_yet_due';
  const days = daysUntilDue(debt.dueDate, today);
  if (days < 0) return 'overdue';
  if (days === 0) return 'due_today';
  if (days <= DEBT_DUE_SOON_WINDOW_DAYS) return 'due_soon';
  return 'not_yet_due';
}

function formatRateNumber(rate: number): string {
  return Number(rate.toFixed(2)).toString();
}

/** "ดอกเบี้ย 16.5% ต่อปี (ประมาณ 1.38% ต่อเดือน)" */
export function formatInterestRateSummary(annualRatePercent: number): string {
  const monthly = annualRatePercent / 12;
  return `ดอกเบี้ย ${formatRateNumber(annualRatePercent)}% ต่อปี (ประมาณ ${formatRateNumber(monthly)}% ต่อเดือน)`;
}
