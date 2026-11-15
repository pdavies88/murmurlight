import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

import { getSettings, updateSettings } from './app-settings';

type MindfulHealthModule = {
  isAvailable(): boolean;
  requestAccess(): Promise<boolean>;
  saveSession(startMs: number, endMs: number): Promise<boolean>;
};

/** The Swift module in native/MindfulHealth.swift. Missing on Android, the web and Expo Go. */
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<MindfulHealthModule>('MindfulHealth') : null;

/** Sessions shorter than this aren't worth a Health entry. */
export const MIN_MINDFUL_SECONDS = 60;

export function healthAvailable(): boolean {
  try {
    return native?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/**
 * Turns mindful minutes on or off. Turning on shows the Health permission sheet the first time.
 * Returns the new setting, which stays off when Health access isn't granted.
 */
export async function setLogToHealth(on: boolean): Promise<boolean> {
  if (!on || !native) {
    updateSettings({ logToHealth: false });
    return false;
  }
  const granted = await native.requestAccess().catch(() => false);
  updateSettings({ logToHealth: granted });
  return granted;
}

/** Saves a finished meditation or breathing session to Apple Health, when the user turned this on. */
export function logMindfulSession(startMs: number, endMs: number): void {
  if (!native || !getSettings().logToHealth) return;
  if ((endMs - startMs) / 1000 < MIN_MINDFUL_SECONDS) return;
  native.saveSession(startMs, endMs).catch(() => undefined);
}
