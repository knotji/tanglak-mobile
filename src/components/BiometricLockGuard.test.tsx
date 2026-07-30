import type { ReactNode } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appStateCallback: null as null | ((state: { isActive: boolean }) => void),
  authenticateBiometrics: vi.fn(),
  isBiometricLockEnabled: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock('@capacitor/app', () => ({
  App: {
    addListener: vi.fn((_event: string, callback: (state: { isActive: boolean }) => void) => {
      mocks.appStateCallback = callback;
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));
vi.mock('@ionic/react', () => ({
  IonButton: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => <button onClick={onClick}>{children}</button>,
  IonIcon: () => null,
  IonSpinner: () => <span>loading</span>,
}));
vi.mock('@/lib/biometrics', () => ({
  authenticateBiometrics: mocks.authenticateBiometrics,
  isBiometricLockEnabled: mocks.isBiometricLockEnabled,
}));

import BiometricLockGuard from '@/components/BiometricLockGuard';

describe('BiometricLockGuard', () => {
  beforeEach(() => {
    mocks.appStateCallback = null;
    mocks.authenticateBiometrics.mockReset();
    mocks.authenticateBiometrics.mockResolvedValue(true);
    mocks.isBiometricLockEnabled.mockReset();
    mocks.isBiometricLockEnabled.mockReturnValueOnce(false).mockReturnValue(true);
  });

  it('relocks while backgrounded and authenticates again on resume', async () => {
    render(<BiometricLockGuard><div>private finance data</div></BiometricLockGuard>);
    expect(screen.getByText('private finance data')).toBeInTheDocument();
    await waitFor(() => expect(mocks.appStateCallback).not.toBeNull());

    act(() => mocks.appStateCallback?.({ isActive: false }));
    expect(screen.queryByText('private finance data')).not.toBeInTheDocument();
    expect(mocks.authenticateBiometrics).not.toHaveBeenCalled();

    act(() => mocks.appStateCallback?.({ isActive: true }));
    await waitFor(() => expect(mocks.authenticateBiometrics).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('private finance data')).toBeInTheDocument();
  });
});
