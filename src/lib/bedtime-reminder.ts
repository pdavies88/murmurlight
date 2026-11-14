import * as Notifications from 'expo-notifications';
import { AndroidImportance } from 'expo-notifications';
import { Platform } from 'react-native';

import { APP_NAME } from '@/constants/brand';

/** The reminder is the app's only notification, so it has a fixed id and replacing it is simple. */
const REMINDER_ID = 'bedtime-reminder';
const CHANNEL_ID = 'bedtime';

// Show the reminder as a banner even if the app happens to be open at bedtime.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function allowed(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const asked = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return asked.granted;
}

/**
 * Schedules a gentle daily reminder at `minutes` after midnight, or removes it for null.
 * Returns false when notifications aren't allowed, so the caller can keep the reminder off.
 */
export async function setBedtimeReminder(minutes: number | null): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => undefined);
  if (minutes === null) return true;
  if (!(await allowed())) return false;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Bedtime reminder',
      importance: AndroidImportance.DEFAULT,
    });
  }
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Time to wind down',
      body: `Open ${APP_NAME} for Wind down, or start your mix.`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Math.floor(minutes / 60),
      minute: minutes % 60,
      channelId: CHANNEL_ID,
    },
  });
  return true;
}
