import { File, Paths } from 'expo-file-system';

import { SOUNDSCAPES } from '@/content/catalog';

import { EMPTY_SAVED_MIX, parseSavedMix, type SavedMix } from './mix';

/**
 * The last mix and sleep timer choice, kept in a small file on the phone so the same mix is one
 * tap away tomorrow night. It never leaves the device.
 */
const FILE_NAME = 'saved-mix.json';

export function loadSavedMix(): SavedMix {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) return EMPTY_SAVED_MIX;
    return parseSavedMix(
      file.textSync(),
      SOUNDSCAPES.map((soundscape) => soundscape.id),
    );
  } catch {
    // No file storage, for example on the web. The app works the same, it just forgets the mix.
    return EMPTY_SAVED_MIX;
  }
}

export function saveMix(saved: SavedMix): void {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) file.create();
    file.writeSync(JSON.stringify(saved));
  } catch {
    // Saving is a convenience. Playback must not fail because of it.
  }
}
