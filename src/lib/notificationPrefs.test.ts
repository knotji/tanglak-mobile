import { describe, expect, it, beforeEach } from 'vitest';
import { isDebtReminderEnabled, setDebtReminderEnabled } from './notificationPrefs';

describe('debt reminder preference', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to disabled when never set', () => {
    expect(isDebtReminderEnabled()).toBe(false);
  });

  it('persists true after being enabled', () => {
    setDebtReminderEnabled(true);
    expect(isDebtReminderEnabled()).toBe(true);
  });

  it('persists false after being disabled', () => {
    setDebtReminderEnabled(true);
    setDebtReminderEnabled(false);
    expect(isDebtReminderEnabled()).toBe(false);
  });
});
