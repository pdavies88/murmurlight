import { requireOptionalNativeModule } from 'expo';
import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { updateSettings } from './app-settings';

type GentleAlarmModule = {
  isAvailable(): boolean;
  isAuthorized(): boolean;
  requestAccess(): Promise<boolean>;
  setDaily(hour: number, minute: number): Promise<boolean>;
  cancel(): Promise<void>;
};

/** The Swift module in native/GentleAlarm.swift. It uses AlarmKit, so it works on iOS 26 and later. */
const native = Platform.OS === 'ios' ? requireOptionalNativeModule<GentleAlarmModule>('GentleAlarm') : null;

const NOTIFICATION_ID = 'gentle-wake';
const CHANNEL_ID = 'wake';
/** Bundled by the expo-notifications config plugin in app.json. */
const SOUND = 'gentle-wake.wav';

function alarmKitAvailable(): boolean {
  try {
    return native?.isAvailable() ?? false;
  } catch {
    return false;
  }
}

/**
 * True when the alarm rings even on silent. An AlarmKit alarm does. The notification fallback, used
 * on older systems or when alarms aren't allowed, follows the ring switch.
 */
export function wakeRingsOnSilent(): boolean {
  try {
    return alarmKitAvailable() && (native?.isAuthorized() ?? false);
  } catch {
    return false;
  }
}

async function scheduleNotification(hour: number, minute: number): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  const granted =
    current.granted ||
    (await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } }))
      .granted;
  if (!granted) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Gentle wake',
      importance: AndroidImportance.HIGH,
      sound: SOUND,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: NOTIFICATION_ID,
    content: { title: 'Good morning', body: 'Time to wake up gently.', sound: SOUND },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: CHANNEL_ID },
  });
  return true;
}

/**
 * Sets the daily gentle wake alarm at `minutes` after midnight, or removes it for null. It uses an
 * AlarmKit alarm when the system has one and allows it, and a notification with the same soft sound otherwise.
 * Returns false when permission isn't granted, and the setting stays off.
 */
export async function setWakeAlarm(minutes: number | null): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => undefined);
  if (alarmKitAvailable()) await native?.cancel().catch(() => undefined);
  if (minutes === null) {
    updateSettings({ wakeMinutes: null });
    return true;
  }
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  let ok = false;
  if (alarmKitAvailable() && native) {
    ok = (await native.requestAccess().catch(() => false)) && (await native.setDaily(hour, minute).catch(() => false));
  }
  // Without AlarmKit, or when alarms aren't allowed, a notification plays the same sound.
  if (!ok) ok = await scheduleNotification(hour, minute).catch(() => false);
  updateSettings({ wakeMinutes: ok ? minutes : null });
  return ok;
}
