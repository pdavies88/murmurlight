/**
 * The sleep journal: each morning the user rates last night from 1 to 5. Each entry remembers the
 * sounds that played that night, so the journal can show which sounds go with better sleep.
 * Everything stays on the phone.
 */

export type SleepRating = 1 | 2 | 3 | 4 | 5;

export const RATING_LABELS: Record<SleepRating, string> = {
  1: 'Badly',
  2: 'Restless',
  3: 'Okay',
  4: 'Well',
  5: 'Deeply',
};

export type JournalEntry = {
  /** The morning's date, as YYYY-MM-DD in local time. */
  date: string;
  rating: SleepRating;
  /** The sounds that played last night, if any. */
  soundIds: string[];
};

export type Journal = {
  entries: JournalEntry[];
  /** The last mix that started playing, so the morning entry knows what played at night. */
  lastPlay: { at: number; soundIds: string[] } | null;
};

export const EMPTY_JOURNAL: Journal = { entries: [], lastPlay: null };
/** About four months of mornings. */
export const MAX_ENTRIES = 120;
/** The morning check-in shows from 4 AM until 2 PM. */
const MORNING_START_HOUR = 4;
const MORNING_END_HOUR = 14;
/** A mix counts as last night's when it started after 5 PM the day before. */
const NIGHT_START_HOUR = 17;

export function dateKey(time: number): string {
  const date = new Date(time);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** True in the morning when today has no entry yet. */
export function shouldAskToday(journal: Journal, now: number): boolean {
  const hour = new Date(now).getHours();
  if (hour < MORNING_START_HOUR || hour >= MORNING_END_HOUR) return false;
  return !journal.entries.some((entry) => entry.date === dateKey(now));
}

/** The sounds that played last night: the last mix started after 5 PM yesterday. */
export function lastNightSounds(journal: Journal, now: number): string[] {
  if (!journal.lastPlay) return [];
  const nightStart = new Date(now);
  nightStart.setDate(nightStart.getDate() - 1);
  nightStart.setHours(NIGHT_START_HOUR, 0, 0, 0);
  const { at, soundIds } = journal.lastPlay;
  return at >= nightStart.getTime() && at <= now ? soundIds : [];
}

/** Adds or replaces today's entry, newest first. */
export function rateNight(journal: Journal, now: number, rating: SleepRating): Journal {
  const date = dateKey(now);
  const entry: JournalEntry = { date, rating, soundIds: lastNightSounds(journal, now) };
  const others = journal.entries.filter((existing) => existing.date !== date);
  return { ...journal, entries: [entry, ...others].slice(0, MAX_ENTRIES) };
}

export function recordPlay(journal: Journal, now: number, soundIds: string[]): Journal {
  return soundIds.length === 0 ? journal : { ...journal, lastPlay: { at: now, soundIds } };
}

export type SoundInsight = { id: string; average: number; nights: number };

/** A sound needs this many rated nights before the journal says anything about it. */
export const MIN_NIGHTS_FOR_INSIGHT = 2;

/** The average rating, and the sounds with the best average over at least two nights. */
export function journalInsights(entries: JournalEntry[]): { average: number | null; bestSounds: SoundInsight[] } {
  if (entries.length === 0) return { average: null, bestSounds: [] };
  const average = entries.reduce((sum, entry) => sum + entry.rating, 0) / entries.length;
  const totals = new Map<string, { sum: number; nights: number }>();
  for (const entry of entries) {
    for (const id of entry.soundIds) {
      const total = totals.get(id) ?? { sum: 0, nights: 0 };
      totals.set(id, { sum: total.sum + entry.rating, nights: total.nights + 1 });
    }
  }
  const bestSounds = [...totals.entries()]
    .filter(([, total]) => total.nights >= MIN_NIGHTS_FOR_INSIGHT)
    .map(([id, total]) => ({ id, average: total.sum / total.nights, nights: total.nights }))
    .sort((a, b) => b.average - a.average || b.nights - a.nights)
    .slice(0, 3);
  return { average, bestSounds };
}

/** Reads a saved journal. Anything broken is dropped, so a damaged file can't break the app. */
export function parseJournal(data: unknown, knownSoundIds: readonly string[]): Journal {
  if (typeof data !== 'object' || data === null) return EMPTY_JOURNAL;
  const { entries, lastPlay } = data as { entries?: unknown; lastPlay?: unknown };
  const cleanIds = (ids: unknown) =>
    Array.isArray(ids) ? ids.filter((id): id is string => typeof id === 'string' && knownSoundIds.includes(id)) : [];
  const seen = new Set<string>();
  const valid: JournalEntry[] = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    if (typeof entry !== 'object' || entry === null) continue;
    const { date, rating, soundIds } = entry as { date?: unknown; rating?: unknown; soundIds?: unknown };
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || seen.has(date)) continue;
    if (typeof rating !== 'number' || ![1, 2, 3, 4, 5].includes(rating)) continue;
    seen.add(date);
    valid.push({ date, rating: rating as SleepRating, soundIds: cleanIds(soundIds) });
  }
  valid.sort((a, b) => (a.date < b.date ? 1 : -1));
  let play: Journal['lastPlay'] = null;
  if (typeof lastPlay === 'object' && lastPlay !== null) {
    const { at, soundIds } = lastPlay as { at?: unknown; soundIds?: unknown };
    const ids = cleanIds(soundIds);
    if (typeof at === 'number' && ids.length > 0) play = { at, soundIds: ids };
  }
  return { entries: valid.slice(0, MAX_ENTRIES), lastPlay: play };
}
