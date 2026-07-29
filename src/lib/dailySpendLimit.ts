import { formatTHB } from '@/lib/money';
import { nowBangkokDatetimeLocal } from '@/lib/bangkokDate';

export interface DailySpendLimitResult {
  hasPlannedIncome: boolean;
  dailyLimitSatang: number;
  todaySpentSatang: number;
  remainingTodaySatang: number;
  daysRemainingInMonth: number;
  percentageUsedToday: number;
  formattedDailyLimit: string;
  formattedRemainingToday: string;
  statusText: string;
  statusColor: string;
}

/**
 * @param monthSpentSatang total living expenses + debt payments so far this month (incl. today)
 * @param todaySpentSatang living expenses + debt payments spent today only
 * @param debtMinimumsSatang total minimum payments owed this month across active debts
 * @param monthlyIncomeSatang planned income for the month (from the Budget page, same source as OverviewPage).
 *   Pass 0 if the user hasn't set a budget yet -- the result will correctly show ฿0 available rather than
 *   a made-up number.
 */
export function calculateDailySpendLimit(
  monthSpentSatang: number,
  todaySpentSatang: number,
  debtMinimumsSatang: number,
  monthlyIncomeSatang: number,
  now: Date = new Date(),
): DailySpendLimitResult {
  // Bangkok wall-clock day & days-in-month, consistent with the rest of the app's date convention.
  const bangkokLocal = nowBangkokDatetimeLocal(now);
  const year = Number(bangkokLocal.slice(0, 4));
  const month = Number(bangkokLocal.slice(5, 7));
  const currentDay = Number(bangkokLocal.slice(8, 10));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const daysRemaining = Math.max(1, daysInMonth - currentDay + 1);

  // Available funds for daily living = Income - Debt Obligations - Expenses spent before today
  const spentBeforeTodaySatang = Math.max(0, monthSpentSatang - todaySpentSatang);
  const remainingBudgetSatang = Math.max(0, monthlyIncomeSatang - debtMinimumsSatang - spentBeforeTodaySatang);
  const dailyLimitSatang = Math.round(remainingBudgetSatang / daysRemaining);

  const remainingTodaySatang = dailyLimitSatang - todaySpentSatang;
  const hasPlannedIncome = monthlyIncomeSatang > 0;
  const percentageUsedToday = dailyLimitSatang > 0
    ? Math.min(100, Math.round((todaySpentSatang / dailyLimitSatang) * 100))
    : 0;

  let statusText = 'อยู่ในงบประจำวัน';
  let statusColor = '#10b981';

  if (!hasPlannedIncome) {
    statusText = 'ยังไม่ได้ตั้งงบรายรับ';
    statusColor = '#64748b';
  } else if (remainingTodaySatang < 0) {
    statusText = 'เกินงบประจำวัน';
    statusColor = '#ef4444';
  } else if (percentageUsedToday >= 80) {
    statusText = 'ใกล้เต็มงบประจำวัน';
    statusColor = '#d97706';
  }

  return {
    hasPlannedIncome,
    dailyLimitSatang,
    todaySpentSatang,
    remainingTodaySatang,
    daysRemainingInMonth: daysRemaining,
    percentageUsedToday,
    formattedDailyLimit: formatTHB(dailyLimitSatang),
    formattedRemainingToday: formatTHB(Math.abs(remainingTodaySatang)),
    statusText,
    statusColor,
  };
}
