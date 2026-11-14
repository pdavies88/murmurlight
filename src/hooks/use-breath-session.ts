import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
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

import { CUE_AUDIO } from '@/content/audio-files';
import { breathMomentAt, type BreathPattern, type BreathPhaseKind } from '@/lib/breathing';

/** The sphere's size when the lungs are empty, as a share of its full size. */
const EMPTY_SCALE = 0.5;
const KEEP_AWAKE_TAG = 'breathing';
/** How often the countdown is checked against the clock. */
const TICK_MS = 100;

/** Soft tones for breathing in, holding and breathing out. Created on first use and kept. */
const cuePlayers: Partial<Record<BreathPhaseKind, AudioPlayer>> = {};
/** The tones sit under any sound mix that is playing, so they guide without startling. */
const CUE_VOLUME = 0.6;

function playCue(kind: BreathPhaseKind): void {
  try {
    let player = cuePlayers[kind];
    if (!player) {
      player = createAudioPlayer(CUE_AUDIO[kind]);
      player.volume = CUE_VOLUME;
      cuePlayers[kind] = player;
    }
    void player.seekTo(0).then(() => player.play());
  } catch {
    // A tone is a convenience. The pacer works without it.
  }
}

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
 * Returns where the session is, and the animated style that grows and shrinks the orb. Each
 * change plays a haptic tap and, when `withSound` is on, a soft tone.
 * The screen stays on while it runs, because nobody touches it.
 */
export function useBreathSession(pattern: BreathPattern, startedAt: number | null, withSound = true) {
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
    if (withSound) playCue(kind);
    if (reduceMotion || kind === 'hold') return;
    scale.value = withTiming(kind === 'in' ? 1 : EMPTY_SCALE, {
      duration: seconds * 1000,
      easing: Easing.inOut(Easing.sin),
    });
  }, [running, phaseKey, kind, seconds, reduceMotion, scale, withSound]);
  const orbStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { running, elapsed, moment, orbStyle };
}
