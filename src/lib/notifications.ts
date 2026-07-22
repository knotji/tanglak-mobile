import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';
import type { Debt } from '@/lib/debts';

export async function requestNotificationPermission(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true; // Web notification mock
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
      if (!debt.dueDate) continue;

      // Schedule 3 days before due date at 09:00 AM
      const due = new Date(debt.dueDate);
      const reminderDate = new Date(due.getTime() - 3 * 24 * 60 * 60 * 1000);
      reminderDate.setHours(9, 0, 0, 0);

      if (reminderDate.getTime() > Date.now()) {
        idCounter += 1;
        notificationsToSchedule.push({
          id: idCounter,
          title: `🔔 แจ้งเตือนชำระหนี้: ${debt.name}`,
          body: `อีก 3 วันจะถึงกำหนดชำระหนี้ ${debt.name} (ครบกำหนดวันที่ ${debt.dueDate})`,
          schedule: { at: reminderDate },
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
