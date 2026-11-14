import { Platform } from 'react-native';

import { findSoundscape } from '@/content/catalog';
import MixesWidget from '@/widgets/mixes-widget';

import type { MixSound, NamedMix } from './mix';

function describeSounds(sounds: MixSound[]): string {
  return sounds.map((sound) => findSoundscape(sound.id)?.title ?? sound.id).join(' + ');
}

/** Sends the saved mixes to the home screen widget, or the current mix when none are saved. */
export function updateMixesWidget(library: NamedMix[], current: MixSound[]): void {
  if (Platform.OS !== 'ios') return;
  const mixes = library.length
    ? library.map((mix) => ({ id: mix.id, name: mix.name, detail: describeSounds(mix.sounds) }))
    : current.length
      ? [{ id: 'current', name: 'Your mix', detail: describeSounds(current) }]
      : [];
  try {
    MixesWidget.updateSnapshot({ mixes });
  } catch {
    // The widget is a convenience. The app works without it.
  }
}
