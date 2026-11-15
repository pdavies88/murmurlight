import catalog from '../../content/catalog.json';

import { MEDITATION_AUDIO, SOUNDSCAPE_AUDIO } from './audio-files';

export type Meditation = {
  id: string;
  title: string;
  minutes: number;
  description: string;
  categoryId: string;
  categoryTitle: string;
};

export type Category = {
  id: string;
  title: string;
  description: string;
  meditations: Meditation[];
};

export type Soundscape = {
  id: string;
  title: string;
  description: string;
  /** The id of the sound category the Sounds tab lists it under. */
  category: string;
};

/** A section of the Sounds tab, such as Nature or Music. */
export type SoundCategory = {
  id: string;
  title: string;
  description: string;
  soundscapes: Soundscape[];
};

export const CATEGORIES: Category[] = catalog.categories.map((category) => ({
  id: category.id,
  title: category.title,
  description: category.description,
  meditations: category.meditations.map((meditation) => ({
    ...meditation,
    categoryId: category.id,
    categoryTitle: category.title,
  })),
}));

export const MEDITATIONS: Meditation[] = CATEGORIES.flatMap((category) => category.meditations);

export const SOUNDSCAPES: Soundscape[] = catalog.soundscapes;

/** The Sounds tab's sections, in order, each with its sounds. */
export const SOUND_CATEGORIES: SoundCategory[] = catalog.soundCategories.map((category) => ({
  ...category,
  soundscapes: SOUNDSCAPES.filter((soundscape) => soundscape.category === category.id),
}));

export function findMeditation(id: string): Meditation | undefined {
  return MEDITATIONS.find((meditation) => meditation.id === id);
}

export function findSoundscape(id: string): Soundscape | undefined {
  return SOUNDSCAPES.find((soundscape) => soundscape.id === id);
}

/** The bundled audio file for a meditation or soundscape. Every catalog entry has one. */
export function audioFor(kind: 'meditation' | 'soundscape', id: string): number {
  const source = kind === 'meditation' ? MEDITATION_AUDIO[id] : SOUNDSCAPE_AUDIO[id];
  if (source === undefined) {
    throw new Error(`No bundled audio for ${kind} "${id}"`);
  }
  return source;
}
