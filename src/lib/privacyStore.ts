import { create } from 'zustand';

const PRIVACY_KEY = 'tl_privacy_mode';

function readStoredPrivacyMode(): boolean {
  try {
    return localStorage.getItem(PRIVACY_KEY) === 'true';
  } catch {
    return false;
  }
}

function writeStoredPrivacyMode(val: boolean): void {
  try {
    localStorage.setItem(PRIVACY_KEY, String(val));
  } catch {
    // Ignore storage errors
  }
}

interface PrivacyState {
  isPrivacy: boolean;
  setPrivacyMode: (val: boolean) => void;
  togglePrivacyMode: () => void;
}

// Replaces a hand-rolled listener-array pub/sub with Zustand -- same
// localStorage-backed persistence, but consumers now subscribe via
// Zustand's own selector mechanism instead of each component managing its
// own useState + useEffect subscribe/unsubscribe pair.
const usePrivacyStore = create<PrivacyState>((set, get) => ({
  isPrivacy: readStoredPrivacyMode(),
  setPrivacyMode: (val) => {
    writeStoredPrivacyMode(val);
    set({ isPrivacy: val });
  },
  togglePrivacyMode: () => get().setPrivacyMode(!get().isPrivacy),
}));

/** Reactive read -- re-renders the calling component when privacy mode changes. */
export function usePrivacyMode(): boolean {
  return usePrivacyStore((state) => state.isPrivacy);
}

/** Non-reactive read, e.g. for one-off checks outside a component. */
export function getPrivacyMode(): boolean {
  return usePrivacyStore.getState().isPrivacy;
}

export function setPrivacyMode(val: boolean): void {
  usePrivacyStore.getState().setPrivacyMode(val);
}

export function togglePrivacyMode(): boolean {
  usePrivacyStore.getState().togglePrivacyMode();
  return usePrivacyStore.getState().isPrivacy;
}

export function maskAmount(amountText: string, isPrivacy: boolean): string {
  if (!isPrivacy) return amountText;
  if (!amountText) return '฿***';
  return amountText.replace(/฿?\s*[\d,]+(\.\d+)?/g, '฿***,***');
}
