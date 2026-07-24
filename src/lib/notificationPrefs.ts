const DEBT_REMINDER_KEY = 'tl_debt_reminder_enabled';

/** Debt due-date reminders are opt-in: absent/unset means disabled, not enabled. */
export function isDebtReminderEnabled(): boolean {
  try {
    return localStorage.getItem(DEBT_REMINDER_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDebtReminderEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(DEBT_REMINDER_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}
