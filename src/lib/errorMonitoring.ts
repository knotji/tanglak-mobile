import { Capacitor } from '@capacitor/core';
import { FirebaseCrashlytics } from '@capacitor-firebase/crashlytics';

/**
 * Reports only a fixed event label. Financial values, transaction details,
 * routes, user identifiers, and the original error message are deliberately
 * excluded from Crashlytics.
 */
export async function reportAppFailure(event: 'react_render_failure' | 'unhandled_error' | 'unhandled_rejection'): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    await FirebaseCrashlytics.recordException({
      message: `TangLak ${event}`,
      keysAndValues: [
        { key: 'event', value: event, type: 'string' },
      ],
    });
  } catch {
    // Monitoring must never become another app failure.
  }
}

export function installGlobalErrorMonitoring(): () => void {
  const onError = () => {
    void reportAppFailure('unhandled_error');
  };
  const onUnhandledRejection = () => {
    void reportAppFailure('unhandled_rejection');
  };

  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
