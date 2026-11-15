import { useSyncExternalStore } from 'react';

import { readJsonFile, writeJsonFile } from './json-file';

/** Wake alarm choices, in minutes after midnight: 6:00 to 8:00 AM. */
export const WAKE_TIMES = [6 * 60, 6 * 60 + 30, 7 * 60, 7 * 60 + 30, 8 * 60] as const;

export type AppSettings = {
  /** Save meditation and breathing sessions to Apple Health as mindful minutes. */
  logToHealth: boolean;
  /** The daily gentle wake alarm, in minutes after midnight, or null for none. */
  wakeMinutes: number | null;
};

export const DEFAULT_SETTINGS: AppSettings = { logToHealth: false, wakeMinutes: null };

export function parseSettings(data: unknown): AppSettings {
  if (typeof data !== 'object' || data === null) return DEFAULT_SETTINGS;
  const { logToHealth, wakeMinutes } = data as { logToHealth?: unknown; wakeMinutes?: unknown };
  return {
    logToHealth: logToHealth === true,
    wakeMinutes: (WAKE_TIMES as readonly number[]).includes(wakeMinutes as number) ? (wakeMinutes as number) : null,
  };
}

const FILE_NAME = 'settings.json';
let current: AppSettings | null = null;
const listeners = new Set<() => void>();

export function getSettings(): AppSettings {
  current ??= parseSettings(readJsonFile(FILE_NAME));
  return current;
}

export function updateSettings(change: Partial<AppSettings>): void {
  current = { ...getSettings(), ...change };
  writeJsonFile(FILE_NAME, current);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSettings(): AppSettings {
  return useSyncExternalStore(subscribe, getSettings, getSettings);
}
