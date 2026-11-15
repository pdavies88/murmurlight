import * as AppIntents from 'expo-app-intents';

import { MIX_PRESETS } from '@/content/presets';

import type { NamedMix } from './mix';

/**
 * Tells Siri and Shortcuts which mixes exist, so "Play Bedtime in Murmurlight" works. Saved mixes
 * come first, then the ready-made ones. The Swift MixQuery in app-intents/ reads this catalog.
 */
export function publishMixesToSiri(library: NamedMix[]): void {
  if (!AppIntents.isAvailable()) return;
  const saved = library.map((mix) => ({ id: mix.id, title: mix.name, subtitle: 'Your mix' }));
  const presets = MIX_PRESETS.filter((preset) => !library.some((mix) => mix.name === preset.title)).map((preset) => ({
    id: preset.id,
    title: preset.title,
    subtitle: 'Ready-made mix',
  }));
  AppIntents.setEntityCatalogAsync('mix', [...saved, ...presets]).catch(() => undefined);
}
