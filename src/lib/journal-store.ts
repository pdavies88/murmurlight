import { useSyncExternalStore } from 'react';

import { SOUNDSCAPES } from '@/content/catalog';

import { readJsonFile, writeJsonFile } from './json-file';
import { parseJournal, rateNight, recordPlay, type Journal, type SleepRating } from './sleep-journal';

const FILE_NAME = 'sleep-journal.json';
let current: Journal | null = null;
const listeners = new Set<() => void>();

function getJournal(): Journal {
  current ??= parseJournal(
    readJsonFile(FILE_NAME),
    SOUNDSCAPES.map((soundscape) => soundscape.id),
  );
  return current;
}

function save(next: Journal): void {
  current = next;
  writeJsonFile(FILE_NAME, next);
  for (const listener of listeners) listener();
}

/** Remembers the mix that just started, for tomorrow morning's entry. */
export function noteMixPlayed(soundIds: string[]): void {
  save(recordPlay(getJournal(), Date.now(), soundIds));
}

export function rateLastNight(rating: SleepRating): void {
  save(rateNight(getJournal(), Date.now(), rating));
}

export function deleteJournalEntry(date: string): void {
  const journal = getJournal();
  save({ ...journal, entries: journal.entries.filter((entry) => entry.date !== date) });
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useJournal(): Journal {
  return useSyncExternalStore(subscribe, getJournal, getJournal);
}
