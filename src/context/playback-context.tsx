import {
  requestNotificationPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioMetadata,
} from 'expo-audio';
import { createContext, use, useEffect, useEffectEvent, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { APP_NAME } from '@/constants/brand';
import { audioFor, findMeditation, findSoundscape } from '@/content/catalog';
import {
  MAX_MIX_SOUNDS,
  driftFactor,
  fadeGain,
  setVolumeInMix,
  toggleInMix,
  type MixSound,
} from '@/lib/mix';
import { loadArtwork, setRemoteChangeHandler, syncMixPlayers } from '@/lib/mix-engine';
import { loadSavedMix, saveMix } from '@/lib/saved-mix';
import { hideSleepTimer, showSleepTimer } from '@/lib/sleep-activity';
import type { SleepTimerActivityProps } from '@/widgets/sleep-timer-activity';
import { clampPosition } from '@/lib/time';

/** The meditation that is loaded in the player. */
export type Track = {
  id: string;
  title: string;
  subtitle: string;
};

type PlaybackContextValue = {
  track: Track | null;
  /** True while a meditation is playing. */
  isPlaying: boolean;
  /** Seconds into the meditation. */
  position: number;
  duration: number;
  /** True once a meditation has played to the end. */
  finished: boolean;
  playMeditation: (id: string) => void;
  toggle: () => void;
  stop: () => void;
  seekBy: (seconds: number) => void;
  seekTo: (seconds: number) => void;

  /** The sounds in the mix, each with its own volume. The mix is saved on the phone. */
  mix: MixSound[];
  mixPlaying: boolean;
  /** True when the mix can't take another sound. */
  mixFull: boolean;
  /** Adds a sound to the mix and starts playing, or removes it. */
  toggleSound: (id: string) => void;
  setSoundVolume: (id: string, volume: number) => void;
  /** Replaces the mix with a ready-made one and plays it. */
  playPreset: (sounds: MixSound[]) => void;
  /** Replaces the mix without playing it. */
  setMixSounds: (sounds: MixSound[]) => void;
  toggleMix: () => void;
  /** Plays the mix, with the sleep timer if one is chosen. */
  playMix: () => void;
  clearMix: () => void;
  /** When on, each sound's volume slowly rises and falls so the mix feels alive. */
  drift: boolean;
  setDrift: (drift: boolean) => void;
  /** The chosen sleep timer length, or null for no timer. */
  timerMinutes: number | null;
  setTimerMinutes: (minutes: number | null) => void;
  /** Seconds until the sleep timer stops the mix, or null when no timer is running. */
  timerRemaining: number | null;
  /**
   * Starts the mix the moment the current meditation ends, even with the screen locked. Used by
   * the wind-down routine. Pass false to cancel.
   */
  setMixAfterMeditation: (queued: boolean) => void;
  /**
   * Shows the Live Activity before the mix starts, for the wind-down routine. iOS only lets an app
   * start a Live Activity in the foreground, so it starts here and updates once the mix plays,
   * even with the screen locked. Pass null to remove it.
   */
  setPlannedSleepTimer: (planned: SleepTimerActivityProps | null) => void;
};

const PlaybackContext = createContext<PlaybackContextValue | null>(null);

const SKIP_SECONDS = 15;
/** Wait this long after the last change before writing the mix to the phone. */
const SAVE_DELAY_MS = 500;
/** How often drifting volumes are recalculated. Small steps sound smooth because the waves are slow. */
const DRIFT_TICK_MS = 2_000;

function describe(id: string): Track {
  const meditation = findMeditation(id);
  if (!meditation) throw new Error(`Unknown meditation "${id}"`);
  return { id, title: meditation.title, subtitle: `${meditation.categoryTitle} · ${meditation.minutes} min` };
}

/**
 * All audio in the app. A meditation plays in one player. The sound mixer plays up to
 * `MAX_MIX_SOUNDS` looping sounds together, with a sleep timer that fades them out. Starting a
 * meditation pauses the mix and vice versa. Playback continues with the screen locked, and shows
 * lock-screen / notification controls, which Android also needs to keep playing in the background
 * for more than a few minutes.
 */
export function PlaybackProvider({ children }: { children: ReactNode }) {
  const player = useAudioPlayer(null, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);
  const [track, setTrack] = useState<Track | null>(null);
  const askedForNotifications = useRef(false);
  const mixAfterMeditation = useRef(false);

  const [saved] = useState(loadSavedMix);
  const [mix, setMix] = useState<MixSound[]>(saved.sounds);
  const [mixPlaying, setMixPlaying] = useState(false);
  const [drift, setDrift] = useState(saved.drift);
  const [driftSeconds, setDriftSeconds] = useState(0);
  const [timerMinutes, setTimerMinutesState] = useState<number | null>(saved.timerMinutes);
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);
  const [plannedSleepTimer, setPlannedSleepTimer] = useState<SleepTimerActivityProps | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      // Lock-screen controls require the app to own the audio session.
      interruptionMode: 'doNotMix',
    });
    // A Live Activity can outlive the app. Without a running timer, it's out of date.
    hideSleepTimer();
  }, []);

  // A meditation is finished once it has stopped at its end.
  const finished =
    track !== null && !status.playing && status.duration > 0 && status.currentTime >= status.duration - 0.5;

  // Android 13+ needs notification permission to show media controls. Ask once, on first play.
  const askForNotifications = async () => {
    if (Platform.OS !== 'android' || askedForNotifications.current) return;
    askedForNotifications.current = true;
    await requestNotificationPermissionsAsync().catch(() => undefined);
  };

  const showOnLockScreen = async (next: Track) => {
    await askForNotifications();
    const metadata: AudioMetadata = {
      title: next.title,
      artist: APP_NAME,
      albumTitle: next.subtitle,
      artworkUrl: await loadArtwork(),
    };
    player.setActiveForLockScreen(true, metadata, { showSeekBackward: true, showSeekForward: true });
  };

  const startTimer = (minutes: number | null) => {
    const now = Date.now();
    setTimerStartedAt(minutes ? now : null);
    setTimerEndsAt(minutes ? now + minutes * 60_000 : null);
    setTimerRemaining(minutes ? minutes * 60 : null);
  };

  const beginMix = (sounds: MixSound[] = mix) => {
    if (sounds.length === 0) return;
    mixAfterMeditation.current = false;
    if (track) {
      player.pause();
      player.clearLockScreenControls();
      setTrack(null);
    }
    void askForNotifications();
    setMixPlaying(true);
    startTimer(timerMinutes);
  };

  const haltMix = () => {
    setMixPlaying(false);
    startTimer(null);
  };

  // When a meditation reaches its end, remove its lock-screen controls, and start the mix if the
  // wind-down routine asked for it. This runs while the meditation's audio still keeps the app awake.
  const onMeditationEnd = useEffectEvent(() => {
    player.clearLockScreenControls();
    if (mixAfterMeditation.current) beginMix();
  });
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (update) => {
      if (update.didJustFinish) onMeditationEnd();
    });
    return () => subscription.remove();
  }, [player]);

  // The mix fades out as the sleep timer runs down, then stops. With drift on, each sound also
  // rises and falls on its own slow wave.
  const gain = fadeGain(timerRemaining);
  const playedMix = drift
    ? mix.map((sound, index) => ({ ...sound, volume: sound.volume * driftFactor(driftSeconds, index) }))
    : mix;
  const mixTitles = mix.map((sound) => findSoundscape(sound.id)?.title ?? sound.id).join(' + ');
  useEffect(() => {
    syncMixPlayers(playedMix, gain, mixPlaying, { title: 'Your mix', artist: APP_NAME, albumTitle: mixTitles });
  }, [playedMix, gain, mixPlaying, mixTitles]);

  useEffect(() => {
    if (!drift || !mixPlaying) return;
    const interval = setInterval(() => setDriftSeconds((seconds) => seconds + DRIFT_TICK_MS / 1000), DRIFT_TICK_MS);
    return () => clearInterval(interval);
  }, [drift, mixPlaying]);

  // The lock screen, headphones or a phone call can play or pause the mix too.
  const onRemoteChange = useEffectEvent((playing: boolean) => {
    if (playing === mixPlaying) return;
    if (playing) beginMix();
    else haltMix();
  });
  useEffect(() => {
    setRemoteChangeHandler(onRemoteChange);
    return () => setRemoteChangeHandler(null);
  }, []);

  // Counts the sleep timer down from the clock, so it stays right if the phone delays a tick.
  useEffect(() => {
    if (timerEndsAt === null) return;
    const interval = setInterval(() => {
      const remaining = (timerEndsAt - Date.now()) / 1000;
      if (remaining > 0) {
        setTimerRemaining(remaining);
      } else {
        setMixPlaying(false);
        setTimerStartedAt(null);
        setTimerEndsAt(null);
        setTimerRemaining(null);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timerEndsAt]);

  // The running sleep timer also shows on the Lock Screen and in the Dynamic Island.
  useEffect(() => {
    if (mixPlaying && timerStartedAt !== null && timerEndsAt !== null) {
      showSleepTimer({ mix: mixTitles, startedAt: timerStartedAt, endsAt: timerEndsAt });
    } else if (plannedSleepTimer) {
      showSleepTimer(plannedSleepTimer);
    } else {
      hideSleepTimer();
    }
  }, [mixPlaying, timerStartedAt, timerEndsAt, mixTitles, plannedSleepTimer]);

  useEffect(() => {
    const timeout = setTimeout(() => saveMix({ sounds: mix, timerMinutes, drift }), SAVE_DELAY_MS);
    return () => clearTimeout(timeout);
  }, [mix, timerMinutes, drift]);

  const value: PlaybackContextValue = {
    track,
    isPlaying: status.playing,
    position: status.currentTime,
    duration: status.duration,
    finished,
    playMeditation: (id) => {
      haltMix();
      if (track?.id === id && !finished) {
        player.play();
        return;
      }
      const next = describe(id);
      player.replace(audioFor('meditation', id));
      player.play();
      setTrack(next);
      void showOnLockScreen(next);
    },
    toggle: () => {
      if (!track) return;
      if (status.playing) {
        player.pause();
      } else if (finished) {
        void player.seekTo(0).then(() => player.play());
        void showOnLockScreen(track);
      } else {
        player.play();
      }
    },
    stop: () => {
      mixAfterMeditation.current = false;
      player.pause();
      player.clearLockScreenControls();
      setTrack(null);
    },
    seekBy: (seconds) => {
      void player.seekTo(clampPosition(status.currentTime + seconds, status.duration));
    },
    seekTo: (seconds) => {
      void player.seekTo(clampPosition(seconds, status.duration));
    },

    mix,
    mixPlaying,
    mixFull: mix.length >= MAX_MIX_SOUNDS,
    toggleSound: (id) => {
      const next = toggleInMix(mix, id);
      if (next === mix) return;
      setMix(next);
      if (next.length === 0) haltMix();
      else if (next.length > mix.length && !mixPlaying) beginMix(next);
    },
    setSoundVolume: (id, volume) => setMix(setVolumeInMix(mix, id, volume)),
    playPreset: (sounds) => {
      setMix(sounds);
      beginMix(sounds);
    },
    setMixSounds: setMix,
    toggleMix: () => {
      if (mixPlaying) haltMix();
      else beginMix();
    },
    playMix: () => beginMix(),
    clearMix: () => {
      setMix([]);
      haltMix();
    },
    drift,
    setDrift,
    timerMinutes,
    setTimerMinutes: (minutes) => {
      setTimerMinutesState(minutes);
      if (mixPlaying) startTimer(minutes);
    },
    timerRemaining,
    setMixAfterMeditation: (queued) => {
      mixAfterMeditation.current = queued;
    },
    setPlannedSleepTimer,
  };

  return <PlaybackContext value={value}>{children}</PlaybackContext>;
}

export function usePlayback(): PlaybackContextValue {
  const context = use(PlaybackContext);
  if (!context) {
    throw new Error('usePlayback must be used within a PlaybackProvider');
  }
  return context;
}

export { SKIP_SECONDS };
