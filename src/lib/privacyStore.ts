import { useState, useEffect } from 'react';

const PRIVACY_KEY = 'tl_privacy_mode';

let privacyListeners: Array<(val: boolean) => void> = [];

export function getPrivacyMode(): boolean {
  try {
    return localStorage.getItem(PRIVACY_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setPrivacyMode(val: boolean): void {
  try {
    localStorage.setItem(PRIVACY_KEY, String(val));
  } catch {
    // Ignore storage errors
  }
  privacyListeners.forEach((fn) => fn(val));
}

export function togglePrivacyMode(): boolean {
  const next = !getPrivacyMode();
  setPrivacyMode(next);
  return next;
}

export function usePrivacyMode(): boolean {
  const [privacy, setPrivacy] = useState<boolean>(getPrivacyMode);

  useEffect(() => {
    const handle = (val: boolean) => setPrivacy(val);
    privacyListeners.push(handle);
    return () => {
      privacyListeners = privacyListeners.filter((fn) => fn !== handle);
    };
  }, []);

  return privacy;
}

export function maskAmount(amountText: string, isPrivacy: boolean): string {
  if (!isPrivacy) return amountText;
  if (!amountText) return '฿***';
  return amountText.replace(/฿?\s*[\d,]+(\.\d+)?/g, '฿***,***');
}
