import { afterEach, describe, expect, it, vi } from 'vitest';

const { recordException } = vi.hoisted(() => ({
  recordException: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => true },
}));
vi.mock('@capacitor-firebase/crashlytics', () => ({
  FirebaseCrashlytics: { recordException },
}));

import { installGlobalErrorMonitoring, reportAppFailure } from '@/lib/errorMonitoring';

describe('privacy-safe error monitoring', () => {
  afterEach(() => {
    recordException.mockClear();
  });

  it('reports only a fixed event label without the original error details', async () => {
    await reportAppFailure('react_render_failure');

    expect(recordException).toHaveBeenCalledWith({
      message: 'TangLak react_render_failure',
      keysAndValues: [{ key: 'event', value: 'react_render_failure', type: 'string' }],
    });
  });

  it('captures global errors and promise rejections without reading their payloads', async () => {
    const uninstall = installGlobalErrorMonitoring();
    window.dispatchEvent(new Event('error'));
    window.dispatchEvent(new Event('unhandledrejection'));
    await vi.waitFor(() => expect(recordException).toHaveBeenCalledTimes(2));
    uninstall();
  });
});
