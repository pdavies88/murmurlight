import { describe, expect, it } from '@jest/globals';

import { BREATH_PATTERNS, breathMomentAt, cycleSeconds } from '../breathing';
import {
  DEFAULT_MIX_VOLUME,
  EMPTY_SAVED_MIX,
  DRIFT_FLOOR,
  FADE_SECONDS,
  MAX_MIX_SOUNDS,
  MAX_NAMED_MIXES,
  driftFactor,
  fadeGain,
  formatReminder,
  saveNamedMix,
  parseSavedMix,
  setVolumeInMix,
  toggleInMix,
} from '../mix';

const KNOWN = ['rain', 'fire', 'ocean', 'fan', 'bells'];

describe('toggleInMix', () => {
  it('adds a sound at the default volume and removes it on the second tap', () => {
    const added = toggleInMix([], 'rain');
    expect(added).toEqual([{ id: 'rain', volume: DEFAULT_MIX_VOLUME }]);
    expect(toggleInMix(added, 'rain')).toEqual([]);
  });

  it('leaves a full mix unchanged, but still lets a sound be removed', () => {
    const full = KNOWN.slice(0, MAX_MIX_SOUNDS).reduce(toggleInMix, [] as ReturnType<typeof toggleInMix>);
    expect(full).toHaveLength(MAX_MIX_SOUNDS);
    expect(toggleInMix(full, 'bells')).toBe(full);
    expect(toggleInMix(full, 'rain')).toHaveLength(MAX_MIX_SOUNDS - 1);
  });
});

describe('setVolumeInMix', () => {
  it('changes one sound and clamps to 0–1', () => {
    const mix = [
      { id: 'rain', volume: 0.5 },
      { id: 'fire', volume: 0.5 },
    ];
    expect(setVolumeInMix(mix, 'fire', 2)).toEqual([
      { id: 'rain', volume: 0.5 },
      { id: 'fire', volume: 1 },
    ]);
    expect(setVolumeInMix(mix, 'rain', -1)[0].volume).toBe(0);
  });
});

describe('fadeGain', () => {
  it('is full volume with no timer and before the fade starts', () => {
    expect(fadeGain(null)).toBe(1);
    expect(fadeGain(FADE_SECONDS + 1)).toBe(1);
  });

  it('fades in a straight line to silence', () => {
    expect(fadeGain(FADE_SECONDS / 2)).toBeCloseTo(0.5);
    expect(fadeGain(0)).toBe(0);
    expect(fadeGain(-5)).toBe(0);
  });
});

describe('parseSavedMix', () => {
  it('reads a valid mix', () => {
    const text = JSON.stringify({ sounds: [{ id: 'rain', volume: 0.4 }], timerMinutes: 30 });
    expect(parseSavedMix(text, KNOWN)).toEqual({
      sounds: [{ id: 'rain', volume: 0.4 }],
      timerMinutes: 30,
      drift: false,
      library: [],
      reminderMinutes: null,
    });
    expect(parseSavedMix(JSON.stringify({ sounds: [], drift: true }), KNOWN).drift).toBe(true);
  });

  it('returns an empty mix for damaged text', () => {
    expect(parseSavedMix('not json', KNOWN)).toEqual(EMPTY_SAVED_MIX);
    expect(parseSavedMix('null', KNOWN)).toEqual(EMPTY_SAVED_MIX);
    expect(parseSavedMix('[]', KNOWN)).toEqual(EMPTY_SAVED_MIX);
  });

  it('drops unknown sounds, duplicates, extra sounds and bad timers', () => {
    const text = JSON.stringify({
      sounds: [
        { id: 'gone', volume: 0.5 },
        { id: 'rain', volume: 9 },
        { id: 'rain', volume: 0.1 },
        { id: 'fire' },
        { id: 'ocean', volume: 0.2 },
        { id: 'fan', volume: 0.3 },
        { id: 'bells', volume: 0.3 },
        'junk',
      ],
      timerMinutes: 7,
    });
    const saved = parseSavedMix(text, KNOWN);
    expect(saved.sounds).toEqual([
      { id: 'rain', volume: 1 },
      { id: 'fire', volume: DEFAULT_MIX_VOLUME },
      { id: 'ocean', volume: 0.2 },
      { id: 'fan', volume: 0.3 },
    ]);
    expect(saved.timerMinutes).toBeNull();
  });
});

describe('bedtime reminder', () => {
  it('formats the time and keeps only the offered times', () => {
    expect(formatReminder(21 * 60)).toBe('9:00 PM');
    expect(formatReminder(22 * 60 + 30)).toBe('10:30 PM');
    expect(parseSavedMix(JSON.stringify({ reminderMinutes: 22 * 60 }), KNOWN).reminderMinutes).toBe(22 * 60);
    expect(parseSavedMix(JSON.stringify({ reminderMinutes: 61 }), KNOWN).reminderMinutes).toBeNull();
  });
});

describe('named mixes', () => {
  const rain = [{ id: 'rain', volume: 0.5 }];
  const fire = [{ id: 'fire', volume: 0.6 }];

  it('saves at the front, trims the name and replaces one with the same name', () => {
    let library = saveNamedMix([], '  Bedtime  ', rain, 'a');
    library = saveNamedMix(library, 'Focus', fire, 'b');
    expect(library.map((mix) => mix.name)).toEqual(['Focus', 'Bedtime']);
    library = saveNamedMix(library, 'bedtime', fire, 'c');
    expect(library.map((mix) => [mix.id, mix.name])).toEqual([
      ['c', 'bedtime'],
      ['b', 'Focus'],
    ]);
  });

  it('ignores empty names and empty mixes, and keeps at most the limit', () => {
    expect(saveNamedMix([], '   ', rain, 'a')).toEqual([]);
    expect(saveNamedMix([], 'Empty', [], 'a')).toEqual([]);
    let library = saveNamedMix([], 'Mix 0', rain, '0');
    for (let i = 1; i <= MAX_NAMED_MIXES; i++) library = saveNamedMix(library, `Mix ${i}`, rain, `${i}`);
    expect(library).toHaveLength(MAX_NAMED_MIXES);
    expect(library.some((mix) => mix.name === 'Mix 0')).toBe(false);
  });

  it('reads a saved library and drops broken entries', () => {
    const text = JSON.stringify({
      sounds: [],
      library: [
        { id: 'a', name: 'Bedtime', sounds: [{ id: 'rain', volume: 0.5 }] },
        { id: 'a', name: 'Duplicate id', sounds: [{ id: 'rain', volume: 0.5 }] },
        { id: 'b', name: '', sounds: [{ id: 'rain', volume: 0.5 }] },
        { id: 'c', name: 'Only unknown sounds', sounds: [{ id: 'gone', volume: 0.5 }] },
        'junk',
      ],
    });
    expect(parseSavedMix(text, KNOWN).library).toEqual([
      { id: 'a', name: 'Bedtime', sounds: [{ id: 'rain', volume: 0.5 }] },
    ]);
  });
});

describe('driftFactor', () => {
  it('stays between the floor and full volume', () => {
    for (let index = 0; index < 4; index++) {
      for (let seconds = 0; seconds < 600; seconds += 7) {
        const factor = driftFactor(seconds, index);
        expect(factor).toBeGreaterThanOrEqual(DRIFT_FLOOR - 1e-9);
        expect(factor).toBeLessThanOrEqual(1 + 1e-9);
      }
    }
  });

  it('moves each sound on its own wave', () => {
    expect(driftFactor(30, 0)).not.toBeCloseTo(driftFactor(30, 1));
  });
});

describe('breathing', () => {
  const box = BREATH_PATTERNS[0];

  it('has patterns with positive phase lengths', () => {
    for (const pattern of BREATH_PATTERNS) {
      expect(pattern.phases.every((phase) => phase.seconds > 0)).toBe(true);
    }
    expect(cycleSeconds(box)).toBe(16);
  });

  it('finds the phase, countdown and cycle count from the clock', () => {
    expect(breathMomentAt(box, 0)).toMatchObject({ phaseIndex: 0, secondsLeft: 4, cycles: 0 });
    expect(breathMomentAt(box, 3.2)).toMatchObject({ phaseIndex: 0, secondsLeft: 1 });
    expect(breathMomentAt(box, 4)).toMatchObject({ phaseIndex: 1, secondsLeft: 4 });
    expect(breathMomentAt(box, 15.5)).toMatchObject({ phaseIndex: 3, secondsLeft: 1, cycles: 0 });
    expect(breathMomentAt(box, 16)).toMatchObject({ phaseIndex: 0, secondsLeft: 4, cycles: 1 });
    expect(breathMomentAt(box, -3)).toMatchObject({ phaseIndex: 0, cycles: 0 });
  });
});
