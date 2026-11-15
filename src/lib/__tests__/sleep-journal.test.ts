import { describe, expect, it } from '@jest/globals';

import { parseSettings } from '../app-settings';
import {
  EMPTY_JOURNAL,
  MAX_ENTRIES,
  dateKey,
  journalInsights,
  lastNightSounds,
  parseJournal,
  rateNight,
  recordPlay,
  shouldAskToday,
  type JournalEntry,
} from '../sleep-journal';

const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).getTime();
const KNOWN = ['rain', 'fire', 'ocean'];

describe('sleep journal', () => {
  it('asks in the morning only, and only until today is rated', () => {
    expect(shouldAskToday(EMPTY_JOURNAL, at(14, 7))).toBe(true);
    expect(shouldAskToday(EMPTY_JOURNAL, at(14, 3))).toBe(false);
    expect(shouldAskToday(EMPTY_JOURNAL, at(14, 15))).toBe(false);
    const rated = rateNight(EMPTY_JOURNAL, at(14, 7), 4);
    expect(shouldAskToday(rated, at(14, 9))).toBe(false);
    expect(shouldAskToday(rated, at(15, 7))).toBe(true);
  });

  it("remembers last night's mix, but not one from an earlier day", () => {
    const played = recordPlay(EMPTY_JOURNAL, at(13, 22), ['rain', 'fire']);
    expect(lastNightSounds(played, at(14, 7))).toEqual(['rain', 'fire']);
    expect(lastNightSounds(played, at(15, 7))).toEqual([]);
    expect(lastNightSounds(recordPlay(EMPTY_JOURNAL, at(13, 15), ['rain']), at(14, 7))).toEqual([]);
    const entry = rateNight(played, at(14, 7), 5).entries[0];
    expect(entry).toEqual({ date: dateKey(at(14, 7)), rating: 5, soundIds: ['rain', 'fire'] });
  });

  it('replaces a second rating on the same morning and keeps at most the limit', () => {
    let journal = rateNight(EMPTY_JOURNAL, at(14, 7), 2);
    journal = rateNight(journal, at(14, 8), 4);
    expect(journal.entries).toHaveLength(1);
    expect(journal.entries[0].rating).toBe(4);
    const many: JournalEntry[] = Array.from({ length: MAX_ENTRIES + 5 }, (_, i) => ({
      date: dateKey(at(1, 7) - i * 86_400_000),
      rating: 3,
      soundIds: [],
    }));
    expect(rateNight({ entries: many, lastPlay: null }, at(14, 7), 5).entries).toHaveLength(MAX_ENTRIES);
  });

  it('finds the sounds on the best nights once each has two nights', () => {
    const entries: JournalEntry[] = [
      { date: '2026-11-14', rating: 5, soundIds: ['rain'] },
      { date: '2026-11-13', rating: 4, soundIds: ['rain', 'fire'] },
      { date: '2026-11-12', rating: 2, soundIds: ['fire'] },
      { date: '2026-11-11', rating: 3, soundIds: ['ocean'] },
    ];
    const { average, bestSounds } = journalInsights(entries);
    expect(average).toBe(3.5);
    expect(bestSounds).toEqual([
      { id: 'rain', average: 4.5, nights: 2 },
      { id: 'fire', average: 3, nights: 2 },
    ]);
    expect(journalInsights([]).average).toBeNull();
  });

  it('reads a saved journal and drops broken entries and unknown sounds', () => {
    const data = {
      entries: [
        { date: '2026-11-13', rating: 4, soundIds: ['rain', 'gone'] },
        { date: '2026-11-14', rating: 5, soundIds: [] },
        { date: '2026-11-14', rating: 1, soundIds: [] },
        { date: 'yesterday', rating: 3 },
        { date: '2026-11-12', rating: 9 },
        'junk',
      ],
      lastPlay: { at: 5, soundIds: ['gone'] },
    };
    expect(parseJournal(data, KNOWN)).toEqual({
      entries: [
        { date: '2026-11-14', rating: 5, soundIds: [] },
        { date: '2026-11-13', rating: 4, soundIds: ['rain'] },
      ],
      lastPlay: null,
    });
    expect(parseJournal('not an object', KNOWN)).toEqual(EMPTY_JOURNAL);
  });
});

describe('settings', () => {
  it('keeps only offered wake times and a real Health choice', () => {
    expect(parseSettings({ logToHealth: true, wakeMinutes: 7 * 60 })).toEqual({ logToHealth: true, wakeMinutes: 420 });
    expect(parseSettings({ logToHealth: 'yes', wakeMinutes: 3 })).toEqual({ logToHealth: false, wakeMinutes: null });
    expect(parseSettings(null)).toEqual({ logToHealth: false, wakeMinutes: null });
  });
});
