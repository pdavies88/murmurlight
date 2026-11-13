import type { LiveActivity } from 'expo-widgets';
import { Platform } from 'react-native';

import SleepTimerActivity, { type SleepTimerActivityProps } from '@/widgets/sleep-timer-activity';

/**
 * Shows the sleep timer as a Live Activity on iPhone. Live Activities are a convenience: if the
 * user turned them off, or the system refuses one, the timer still works in the app.
 */
let current: LiveActivity<SleepTimerActivityProps> | null = null;

/** Starts the Live Activity, or updates the one already showing. */
export function showSleepTimer(props: SleepTimerActivityProps): void {
  if (Platform.OS !== 'ios') return;
  try {
    // A relaunch may leave one running from before.
    current ??= SleepTimerActivity.getInstances()[0] ?? null;
    if (current) {
      void current.update(props, new Date(props.endsAt)).catch(() => undefined);
    } else {
      current = SleepTimerActivity.start(props, undefined, new Date(props.endsAt));
    }
  } catch {
    current = null;
  }
}

export function hideSleepTimer(): void {
  if (Platform.OS !== 'ios') return;
  try {
    const instances = current ? [current] : SleepTimerActivity.getInstances();
    for (const instance of instances) void instance.end('immediate').catch(() => undefined);
  } catch {
    // Nothing to end.
  }
  current = null;
}
