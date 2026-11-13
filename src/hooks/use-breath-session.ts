import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { breathMomentAt, type BreathPattern, type BreathPhaseKind } from '@/lib/breathing';

/** The sphere's size when the lungs are empty, as a share of its full size. */
const EMPTY_SCALE = 0.5;
const KEEP_AWAKE_TAG = 'breathing';
/** How often the countdown is checked against the clock. */
const TICK_MS = 100;

/** One tap in the hand at each change, so the pacer works with eyes closed. */
function tap(kind: BreathPhaseKind): void {
  if (Platform.OS === 'web') return;
  const done =
    Platform.OS === 'android'
      ? Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm)
      : Haptics.impactAsync(
          kind === 'in'
            ? Haptics.ImpactFeedbackStyle.Medium
            : kind === 'out'
              ? Haptics.ImpactFeedbackStyle.Soft
              : Haptics.ImpactFeedbackStyle.Light,
        );
  // Haptics can be off or unsupported. The pacer works without them.
  done.catch(() => undefined);
}

/**
 * Runs a breathing session from `startedAt` (milliseconds since 1970, or null when stopped).
 * Returns where the session is, and the animated style that grows and shrinks the orb.
 * The screen stays on while it runs, because nobody touches it.
 */
export function useBreathSession(pattern: BreathPattern, startedAt: number | null) {
  const reduceMotion = useReducedMotion();
  // The clock ticks while a session runs. Right after a start it can still read a moment before
  // `startedAt`, which counts as the very beginning.
  const [now, setNow] = useState(() => Date.now());
  const running = startedAt !== null;
  const elapsed = startedAt === null ? 0 : Math.max(0, (now - startedAt) / 1000);
  const moment = breathMomentAt(pattern, elapsed);

  useEffect(() => {
    if (startedAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, [startedAt]);

  useEffect(() => {
    if (!running) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => undefined);
    return () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => undefined);
    };
  }, [running]);

  // At each new phase: tap, then grow or shrink the sphere over the length of the phase.
  const scale = useSharedValue(EMPTY_SCALE);
  const { kind, seconds } = moment.phase;
  const phaseKey = `${moment.cycles}-${moment.phaseIndex}`;
  useEffect(() => {
    if (!running) {
      cancelAnimation(scale);
      scale.value = withTiming(EMPTY_SCALE, { duration: 400 });
      return;
    }
    tap(kind);
    if (reduceMotion || kind === 'hold') return;
    scale.value = withTiming(kind === 'in' ? 1 : EMPTY_SCALE, {
      duration: seconds * 1000,
      easing: Easing.inOut(Easing.sin),
    });
  }, [running, phaseKey, kind, seconds, reduceMotion, scale]);
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { running, elapsed, moment, orbStyle };
}
