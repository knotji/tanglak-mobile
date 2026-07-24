import { Capacitor } from '@capacitor/core';
import { BiometricAuth, BiometryError, BiometryType } from '@aparajita/capacitor-biometric-auth';

const BIOMETRIC_LOCK_KEY = 'tl_biometric_lock_enabled';

export interface BiometricCheckResult {
  isAvailable: boolean;
  biometricType: 'FaceID' | 'TouchID' | 'Biometrics' | 'None';
  /** True if the device has a PIN/pattern/password set (usable as a fallback). */
  deviceIsSecure: boolean;
}

export function isBiometricLockEnabled(): boolean {
  try {
    return localStorage.getItem(BIOMETRIC_LOCK_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setBiometricLockEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BIOMETRIC_LOCK_KEY, enabled ? 'true' : 'false');
  } catch {
    // Ignore storage errors
  }
}

export async function checkBiometricSupport(): Promise<BiometricCheckResult> {
  if (!Capacitor.isNativePlatform()) {
    return { isAvailable: false, biometricType: 'None', deviceIsSecure: false };
  }
  try {
    const result = await BiometricAuth.checkBiometry();
    let biometricType: BiometricCheckResult['biometricType'] = 'None';
    if (result.biometryType === BiometryType.faceId) biometricType = 'FaceID';
    else if (result.biometryType === BiometryType.touchId) biometricType = 'TouchID';
    else if (result.biometryType !== BiometryType.none) biometricType = 'Biometrics';
    return {
      isAvailable: result.isAvailable,
      biometricType,
      deviceIsSecure: result.deviceIsSecure,
    };
  } catch {
    return { isAvailable: false, biometricType: 'None', deviceIsSecure: false };
  }
}

/**
 * Shows the OS biometric prompt (with device PIN/pattern fallback) and resolves
 * true only if the user actually passed it. On web (dev preview) there is no
 * native prompt, so the lock is a no-op and this resolves true.
 */
export async function authenticateBiometrics(reason: string = 'ยืนยันตัวตนเพื่อปลดล็อกแอปตั้งหลัก'): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }

  const support = await checkBiometricSupport();
  if (!support.isAvailable && !support.deviceIsSecure) {
    // Nothing to authenticate against (no biometry enrolled, no PIN set):
    // fail open instead of locking the user out of their own data forever.
    return true;
  }

  try {
    await BiometricAuth.authenticate({
      reason,
      cancelTitle: 'ยกเลิก',
      allowDeviceCredential: true,
      androidTitle: 'ตั้งหลัก',
      androidSubtitle: reason,
    });
    return true;
  } catch (error) {
    if (error instanceof BiometryError) {
      return false;
    }
    return false;
  }
}
