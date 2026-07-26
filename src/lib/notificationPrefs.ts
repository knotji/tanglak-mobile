import { create } from 'zustand';

const DEBT_REMINDER_KEY = 'tl_debt_reminder_enabled';

function readStoredReminderEnabled(): boolean {
  try {
    return localStorage.getItem(DEBT_REMINDER_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredReminderEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DEBT_REMINDER_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

interface NotificationPrefsState {
  debtReminderEnabled: boolean;
  setDebtReminderEnabled: (enabled: boolean) => void;
}

/** Debt due-date reminders are opt-in: absent/unset means disabled, not enabled. */
const useNotificationPrefsStore = create<NotificationPrefsState>((set) => ({
  debtReminderEnabled: readStoredReminderEnabled(),
  setDebtReminderEnabled: (enabled) => {
    writeStoredReminderEnabled(enabled);
    set({ debtReminderEnabled: enabled });
  },
}));

/** Reactive read -- re-renders the calling component when the reminder preference changes. */
export function useDebtReminderEnabled(): boolean {
  return useNotificationPrefsStore((state) => state.debtReminderEnabled);
}

/** Non-reactive read, e.g. for one-off checks outside a component. */
export function isDebtReminderEnabled(): boolean {
  return useNotificationPrefsStore.getState().debtReminderEnabled;
}

export function setDebtReminderEnabled(enabled: boolean): void {
  useNotificationPrefsStore.getState().setDebtReminderEnabled(enabled);
}
