import type { MixSound } from '@/lib/mix';

export type MixPreset = {
  id: string;
  title: string;
  description: string;
  sounds: MixSound[];
};

/** Ready-made mixes. Tapping one replaces the current mix, and every volume can still be changed. */
export const MIX_PRESETS: MixPreset[] = [
  {
    id: 'rainy-cabin',
    title: 'Rainy cabin',
    description: 'Rain on the roof and a fire in the stove.',
    sounds: [
      { id: 'rain', volume: 0.8 },
      { id: 'fire', volume: 0.45 },
    ],
  },
  {
    id: 'night-shore',
    title: 'Night shore',
    description: 'Slow waves with chimes on the breeze.',
    sounds: [
      { id: 'ocean', volume: 0.8 },
      { id: 'chimes', volume: 0.25 },
    ],
  },
  {
    id: 'deep-focus',
    title: 'Deep focus',
    description: 'Brown noise and a steady fan to block out the room.',
    sounds: [
      { id: 'brown-noise', volume: 0.7 },
      { id: 'fan', volume: 0.4 },
    ],
  },
  {
    id: 'deep-meditation',
    title: 'Deep meditation',
    description: 'Singing bowls over a low, breathing om.',
    sounds: [
      { id: 'bowls', volume: 0.7 },
      { id: 'om', volume: 0.4 },
    ],
  },
  {
    id: 'nap-time',
    title: 'Nap time',
    description: 'A car ride, gentle shushing and a slow heartbeat.',
    sounds: [
      { id: 'car', volume: 0.7 },
      { id: 'shush', volume: 0.35 },
      { id: 'heartbeat', volume: 0.3 },
    ],
  },
];
