import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Debt } from '@/lib/debts';
import { formatTHB } from '@/lib/money';
import { formatThaiDateLabel } from '@/lib/date';

export async function cancelAllDebtReminders(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n: { id: number }) => ({ id: n.id })) });
    }
  } catch {
    // Ignore -- nothing meaningful to recover from here
  }
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    if ('Notification' in window && Notification.permission === 'default') {
      try {
        const res = await Notification.requestPermission();
        return res === 'granted';
      } catch {
        return false;
      }
    }
    return true;
  }
  try {
    const status = await LocalNotifications.requestPermissions();
    return status.display === 'granted';
  } catch {
    return false;
  }
}

export async function scheduleDebtReminders(debts: Debt[]): Promise<number> {
  if (!Capacitor.isNativePlatform()) {
    return 0;
  }

  try {
    // Cancel existing scheduled reminders first
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({ notifications: pending.notifications.map((n: { id: number }) => ({ id: n.id })) });
    }

    const notificationsToSchedule = [];
    let idCounter = 1000;

    for (const debt of debts) {
      if (!debt.dueDate || debt.status === 'paid') continue;

      const due = new Date(`${debt.dueDate}T00:00:00+07:00`);
      const minSatang = debt.minimumPaymentSatang ?? debt.amountDueSatang ?? 0;
      const minText = minSatang > 0 ? ` (ยอดชำระ ${formatTHB(minSatang)})` : '';
      const dueDateLabel = formatThaiDateLabel(debt.dueDate) ?? debt.dueDate;

      // 1. Schedule 3 days before due date at 09:00 AM
      const reminder3Days = new Date(due.getTime() - 3 * 24 * 60 * 60 * 1000);
      reminder3Days.setHours(9, 0, 0, 0);

      if (reminder3Days.getTime() > Date.now()) {
        idCounter += 1;
        notificationsToSchedule.push({
          id: idCounter,
          title: `🔔 แจ้งเตือนชำระหนี้: ${debt.name}`,
          body: `อีก 3 วันจะถึงกำหนดชำระหนี้ ${debt.name}${minText} วันที่ ${dueDateLabel}`,
          schedule: { at: reminder3Days },
          sound: undefined,
          actionTypeId: '',
          extra: { debtId: debt.id },
        });
      }

      // 2. Schedule 1 day before due date at 09:00 AM
      const reminder1Day = new Date(due.getTime() - 1 * 24 * 60 * 60 * 1000);
      reminder1Day.setHours(9, 0, 0, 0);

      if (reminder1Day.getTime() > Date.now()) {
        idCounter += 1;
        notificationsToSchedule.push({
          id: idCounter,
          title: `⚠️ เตือนด่วน! พรุ่งนี้ถึงกำหนดชำระหนี้ ${debt.name}`,
          body: `อย่าลืมชำระหนี้ ${debt.name}${minText} ภายในวันที่ ${dueDateLabel}`,
          schedule: { at: reminder1Day },
          sound: undefined,
          actionTypeId: '',
          extra: { debtId: debt.id },
        });
      }
    }

    if (notificationsToSchedule.length > 0) {
      await LocalNotifications.schedule({ notifications: notificationsToSchedule });
    }

    return notificationsToSchedule.length;
  } catch {
    return 0;
  }
}
