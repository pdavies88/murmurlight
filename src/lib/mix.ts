/** One sound in the mix, with its own volume from 0 to 1. */
export type MixSound = {
  id: string;
  volume: number;
};

/** The most sounds that can play together. More than this turns to mush and costs battery. */
export const MAX_MIX_SOUNDS = 4;
export const DEFAULT_MIX_VOLUME = 0.7;
/** The mix fades out over this many seconds before the sleep timer stops it. */
export const FADE_SECONDS = 60;
/** Sleep timer choices, in minutes. */
export const TIMER_MINUTES = [15, 30, 45, 60] as const;

export function clampVolume(volume: number): number {
  if (!Number.isFinite(volume)) return DEFAULT_MIX_VOLUME;
  return Math.min(Math.max(volume, 0), 1);
}

/** Adds a sound to the mix, or removes it if it's already there. A full mix stays unchanged. */
export function toggleInMix(mix: MixSound[], id: string): MixSound[] {
  if (mix.some((sound) => sound.id === id)) return mix.filter((sound) => sound.id !== id);
  if (mix.length >= MAX_MIX_SOUNDS) return mix;
  return [...mix, { id, volume: DEFAULT_MIX_VOLUME }];
}

export function setVolumeInMix(mix: MixSound[], id: string, volume: number): MixSound[] {
  return mix.map((sound) => (sound.id === id ? { ...sound, volume: clampVolume(volume) } : sound));
}

/**
 * How loud the whole mix plays while a sleep timer runs: full volume until the last
 * `FADE_SECONDS`, then a straight fade to silence. No timer means full volume.
 */
export function fadeGain(remainingSeconds: number | null): number {
  if (remainingSeconds === null) return 1;
  if (remainingSeconds <= 0) return 0;
  return Math.min(1, remainingSeconds / FADE_SECONDS);
}

/** The quietest a drifting sound gets, as a share of the volume the user set. */
export const DRIFT_FLOOR = 0.55;

/**
 * How loud one sound plays when drift is on, as a share of its set volume. Each sound rises and
 * falls on its own slow wave, between 1–2 minutes long, so the mix keeps shifting like real
 * weather instead of looping the same way.
 */
export function driftFactor(seconds: number, index: number): number {
  const periodSeconds = 60 + ((index * 37) % 60);
  const phase = (index * 2.1) % (Math.PI * 2);
  const wave = (Math.sin((seconds / periodSeconds) * Math.PI * 2 + phase) + 1) / 2;
  return DRIFT_FLOOR + (1 - DRIFT_FLOOR) * wave;
}

export type SavedMix = {
  sounds: MixSound[];
  timerMinutes: number | null;
  drift: boolean;
};

export const EMPTY_SAVED_MIX: SavedMix = { sounds: [], timerMinutes: null, drift: false };

/**
 * Reads a saved mix from its JSON text. Anything unreadable, unknown or out of range is dropped,
 * so a damaged file or a sound removed in an update can't break the app.
 */
export function parseSavedMix(text: string, knownIds: readonly string[]): SavedMix {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return EMPTY_SAVED_MIX;
  }
  if (typeof data !== 'object' || data === null) return EMPTY_SAVED_MIX;
  const { sounds, timerMinutes, drift } = data as { sounds?: unknown; timerMinutes?: unknown; drift?: unknown };

  const seen = new Set<string>();
  const validSounds: MixSound[] = [];
  for (const entry of Array.isArray(sounds) ? sounds : []) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { id, volume } = entry as { id?: unknown; volume?: unknown };
    if (typeof id !== 'string' || !knownIds.includes(id) || seen.has(id)) continue;
    if (validSounds.length >= MAX_MIX_SOUNDS) break;
    seen.add(id);
    validSounds.push({ id, volume: clampVolume(typeof volume === 'number' ? volume : DEFAULT_MIX_VOLUME) });
  }

  const validTimer = (TIMER_MINUTES as readonly number[]).includes(timerMinutes as number)
    ? (timerMinutes as number)
    : null;
  return { sounds: validSounds, timerMinutes: validTimer, drift: drift === true };
}
