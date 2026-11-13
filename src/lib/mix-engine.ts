import { Asset } from 'expo-asset';
import { createAudioPlayer, type AudioMetadata, type AudioPlayer } from 'expo-audio';

import { audioFor } from '@/content/catalog';

import type { MixSound } from './mix';

/**
 * The native side of the sound mixer: one looping player per sound in the mix. It lives outside
 * React because expo-audio players are configured by assigning to them, which the React Compiler
 * doesn't allow on values that come from hooks.
 */

type Listener = { remove: () => void };

const players = new Map<string, AudioPlayer>();
let leadId: string | null = null;
let leadListener: Listener | null = null;
let leadTitle = '';
let wantPlaying = false;
let lastCommandAt = 0;
let onRemoteChange: ((playing: boolean) => void) | null = null;

/** After the app starts or pauses a player, its status takes a moment to catch up. */
const SETTLE_MS = 1_500;

// Lock-screen artwork needs a file URL. The app icon is bundled, so this never touches the network.
let artworkUrl: string | undefined;
export async function loadArtwork(): Promise<string | undefined> {
  if (artworkUrl) return artworkUrl;
  try {
    const [asset] = await Asset.loadAsync(require('@/assets/images/icon.png'));
    artworkUrl = asset.localUri ?? asset.uri;
  } catch {
    artworkUrl = undefined;
  }
  return artworkUrl;
}

/** Called when something outside the app plays or pauses the mix: the lock screen, headphones or a phone call. */
export function setRemoteChangeHandler(handler: ((playing: boolean) => void) | null): void {
  onRemoteChange = handler;
}

function watchLead(player: AudioPlayer): void {
  leadListener?.remove();
  leadListener = player.addListener('playbackStatusUpdate', (status) => {
    if (!status.isLoaded || Date.now() - lastCommandAt < SETTLE_MS) return;
    if (status.playing !== wantPlaying) onRemoteChange?.(status.playing);
  });
}

async function showOnLockScreen(player: AudioPlayer, metadata: AudioMetadata): Promise<void> {
  const artwork = await loadArtwork();
  // The mix may have changed while the artwork loaded.
  if (players.get(leadId ?? '') !== player) return;
  player.setActiveForLockScreen(true, { ...metadata, artworkUrl: artwork }, {
    showSeekBackward: false,
    showSeekForward: false,
  });
}

/**
 * Makes the native players match the mix: creates and removes players, sets each volume, and
 * plays or pauses them all. Only one player can own the lock screen controls, so the first sound
 * in the mix does, and `setRemoteChangeHandler` reports when those controls are used.
 */
export function syncMixPlayers(mix: MixSound[], gain: number, playing: boolean, metadata: AudioMetadata): void {
  const resumed = playing && !wantPlaying;
  if (playing !== wantPlaying) lastCommandAt = Date.now();
  wantPlaying = playing;

  for (const [id, player] of players) {
    if (mix.some((sound) => sound.id === id)) continue;
    if (id === leadId) {
      leadListener?.remove();
      leadListener = null;
      player.clearLockScreenControls();
      leadId = null;
    }
    player.pause();
    player.remove();
    players.delete(id);
  }

  for (const sound of mix) {
    let player = players.get(sound.id);
    if (!player) {
      player = createAudioPlayer(audioFor('soundscape', sound.id));
      player.loop = true;
      players.set(sound.id, player);
      lastCommandAt = Date.now();
    }
    player.volume = sound.volume * gain;
    if (playing) {
      player.play();
    } else {
      player.pause();
    }
  }

  const nextLeadId = mix[0]?.id ?? null;
  const nextTitle = `${metadata.title}|${metadata.albumTitle}`;
  const lead = nextLeadId ? players.get(nextLeadId) : undefined;
  if (!lead) return;
  // Take the lock screen back when the mix changes, and when it resumes after a meditation used it.
  if (nextLeadId !== leadId || nextTitle !== leadTitle || resumed) {
    if (nextLeadId !== leadId) watchLead(lead);
    leadId = nextLeadId;
    leadTitle = nextTitle;
    void showOnLockScreen(lead, metadata);
  }
}
