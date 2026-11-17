import { useNavigation } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayPauseIcon } from '@/components/play-pause-icon';
import { SoundIcon } from '@/components/sound-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VolumeSlider } from '@/components/volume-slider';
import { BottomTabInset, DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { SOUND_CATEGORIES, findSoundscape, type Soundscape } from '@/content/catalog';
import { MIX_PRESETS, type MixPreset } from '@/content/presets';
import { usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';
import { MAX_MIX_NAME, MAX_MIX_SOUNDS, TIMER_MINUTES, type NamedMix } from '@/lib/mix';
import { formatClock } from '@/lib/time';

/** Windows at least this wide, such as an unfolded iPhone Duo or a phone in landscape, get three columns. */
const WIDE_WINDOW = 600;

/** The sound mixer: layer sounds, set each volume, and let a sleep timer fade them out. */
export default function SoundsScreen() {
  const window = useWindowDimensions();
  const { stopMix } = usePlayback();

  // Going to another tab stops the mix, so it doesn't keep playing under Breathe or a meditation.
  // Locking the phone or leaving the app doesn't, because the tab stays focused.
  const navigation = useNavigation();
  const onLeave = useEffectEvent(() => stopMix());
  useEffect(() => navigation.addListener('blur', () => onLeave()), [navigation]);
  const wide = window.width >= WIDE_WINDOW;
  // Tiles grow to fill a row, but a lone last tile stops at one column's width instead of the full row.
  const tileSize = { width: wide ? '30%' : '47%', maxWidth: wide ? '32%' : '48%' } as const;

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}>
          <View style={styles.header}>
            <ThemedText type="subtitle" accessibilityRole="header">
              Sounds
            </ThemedText>
            <ThemedText themeColor="textSecondary">
              Layer up to {MAX_MIX_SOUNDS} sounds and set the volume of each. Your mix keeps playing with the screen
              locked.
            </ThemedText>
          </View>
          <MixCard />
          <YourMixes />
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle} accessibilityRole="header">
              Ready-made mixes
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
              {MIX_PRESETS.map((preset) => (
                <PresetCard key={preset.id} preset={preset} />
              ))}
            </ScrollView>
          </View>
          <ThemedText style={styles.sectionTitle} accessibilityRole="header">
            Build your own
          </ThemedText>
          {SOUND_CATEGORIES.map((category) => (
            <View key={category.id} style={styles.section}>
              <View style={styles.categoryHeader}>
                <ThemedText style={styles.categoryTitle} accessibilityRole="header">
                  {category.title}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {category.description}
                </ThemedText>
              </View>
              <View style={styles.grid}>
                {category.soundscapes.map((soundscape) => (
                  <View key={soundscape.id} style={[styles.tileSlot, tileSize]}>
                    <SoundTile soundscape={soundscape} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Play, pause and clear the mix, and choose a sleep timer. */
function MixCard() {
  const theme = useTheme();
  const {
    mix,
    mixPlaying,
    mixFull,
    toggleMix,
    clearMix,
    drift,
    setDrift,
    timerMinutes,
    setTimerMinutes,
    timerRemaining,
    saveCurrentMix,
  } = usePlayback();
  const empty = mix.length === 0;
  // The name being typed for a new saved mix, or null when the save field is closed.
  const [saveName, setSaveName] = useState<string | null>(null);
  const finishSave = () => {
    if (saveName?.trim()) saveCurrentMix(saveName);
    setSaveName(null);
  };
  const names = mix.map((sound) => findSoundscape(sound.id)?.title ?? sound.id).join(' + ');

  const status = empty
    ? 'Tap a sound below to start your mix.'
    : timerRemaining !== null
      ? `Stops in ${formatClock(timerRemaining)}`
      : mixPlaying
        ? 'Playing until you stop it'
        : 'Saved on this phone · ready to play';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardRow}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={mixPlaying ? 'Pause mix' : 'Play mix'}
          accessibilityState={{ disabled: empty }}
          disabled={empty}
          onPress={toggleMix}
          style={({ pressed }) => [
            styles.cardPlay,
            { backgroundColor: theme.tint, opacity: empty ? 0.4 : 1, transform: [{ scale: pressed ? 0.95 : 1 }] },
          ]}>
          <PlayPauseIcon playing={mixPlaying} color={theme.onTint} size={24} />
        </Pressable>
        <View style={styles.cardText}>
          <ThemedText style={styles.cardTitle} numberOfLines={2}>
            {empty ? 'Your mix' : names}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" accessibilityLiveRegion="polite">
            {status}
          </ThemedText>
        </View>
        {empty ? null : (
          <View style={styles.cardActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save mix"
              accessibilityHint="Names this mix and keeps it in Your mixes"
              onPress={() => setSaveName('')}
              style={styles.clear}>
              <ThemedText type="small" style={{ color: theme.tint }}>
                Save
              </ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Clear mix" onPress={clearMix} style={styles.clear}>
              <ThemedText type="small" style={{ color: theme.tint }}>
                Clear
              </ThemedText>
            </Pressable>
          </View>
        )}
      </View>

      {saveName !== null && !empty ? (
        <View style={styles.saveRow}>
          <TextInput
            autoFocus
            value={saveName}
            onChangeText={setSaveName}
            onSubmitEditing={finishSave}
            placeholder="Name this mix, for example Bedtime"
            placeholderTextColor={theme.textSecondary}
            maxLength={MAX_MIX_NAME}
            returnKeyType="done"
            accessibilityLabel="Mix name"
            style={[styles.saveInput, { color: theme.text, borderColor: theme.backgroundSelected }]}
          />
          <Pressable accessibilityRole="button" onPress={finishSave} style={styles.clear}>
            <ThemedText type="small" style={{ color: theme.tint }}>
              Done
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      <View style={styles.timer}>
        <ThemedText type="small" themeColor="textSecondary">
          Sleep timer · fades out at the end
        </ThemedText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          <TimerChip label="Off" selected={timerMinutes === null} onPress={() => setTimerMinutes(null)} />
          {TIMER_MINUTES.map((minutes) => (
            <TimerChip
              key={minutes}
              label={`${minutes} min`}
              selected={timerMinutes === minutes}
              onPress={() => setTimerMinutes(minutes)}
            />
          ))}
        </View>
      </View>

      <View style={styles.driftRow}>
        <View style={styles.cardText}>
          <ThemedText style={styles.driftTitle}>Drift</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Each sound slowly rises and falls, so the mix never sounds like a loop.
          </ThemedText>
        </View>
        <Switch
          accessibilityLabel="Drift"
          value={drift}
          onValueChange={setDrift}
          trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
        />
      </View>

      {mixFull ? (
        <ThemedText type="small" themeColor="textSecondary">
          Your mix is full. Remove a sound to add another.
        </ThemedText>
      ) : null}
    </ThemedView>
  );
}

/** The mixes the user saved. Tap to play or stop one, press and hold to delete it. */
function YourMixes() {
  const { library } = usePlayback();
  if (library.length === 0) return null;
  return (
    <View style={styles.section}>
      <ThemedText style={styles.sectionTitle} accessibilityRole="header">
        Your mixes
      </ThemedText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presets}>
        {library.map((named) => (
          <NamedMixCard key={named.id} named={named} />
        ))}
      </ScrollView>
    </View>
  );
}

function NamedMixCard({ named }: { named: NamedMix }) {
  const theme = useTheme();
  const { mix, mixPlaying, playNamedMix, toggleMix, deleteNamedMix } = usePlayback();
  const playing =
    mixPlaying &&
    mix.length === named.sounds.length &&
    named.sounds.every((sound) => mix.some((entry) => entry.id === sound.id));
  const names = named.sounds.map((sound) => findSoundscape(sound.id)?.title ?? sound.id).join(' + ');
  const confirmDelete = () =>
    Alert.alert(`Delete "${named.name}"?`, 'The sounds stay in the app. Only this saved mix is removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteNamedMix(named.id) },
    ]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: playing }}
      accessibilityLabel={`${named.name}. ${names}`}
      accessibilityHint={playing ? 'Stops this mix' : 'Plays this mix. Press and hold to delete it.'}
      accessibilityActions={[{ name: 'longpress', label: 'Delete' }]}
      onAccessibilityAction={confirmDelete}
      onPress={() => (playing ? toggleMix() : playNamedMix(named.id))}
      onLongPress={confirmDelete}
      style={({ pressed }) => [
        styles.preset,
        { backgroundColor: playing ? theme.tint : theme.backgroundElement, transform: [{ scale: pressed ? 0.97 : 1 }] },
      ]}>
      <View style={styles.presetIcons}>
        {named.sounds.map((sound) => (
          <SoundIcon key={sound.id} id={sound.id} color={playing ? theme.onTint : theme.tint} size={24} />
        ))}
      </View>
      <ThemedText numberOfLines={1} style={[styles.tileTitle, { color: playing ? theme.onTint : theme.text }]}>
        {named.name}
      </ThemedText>
      <ThemedText type="small" numberOfLines={2} style={{ color: playing ? theme.onTint : theme.textSecondary }}>
        {names}
      </ThemedText>
    </Pressable>
  );
}

function PresetCard({ preset }: { preset: MixPreset }) {
  const theme = useTheme();
  const { mix, mixPlaying, playPreset, toggleMix } = usePlayback();
  const playing =
    mixPlaying &&
    mix.length === preset.sounds.length &&
    preset.sounds.every((sound) => mix.some((entry) => entry.id === sound.id));
  const names = preset.sounds.map((sound) => findSoundscape(sound.id)?.title ?? sound.id).join(' + ');

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: playing }}
      accessibilityLabel={`${preset.title}. ${names}`}
      accessibilityHint={playing ? 'Stops this mix' : 'Replaces your mix with this one and plays it'}
      // A second tap stops it, like a sound tile.
      onPress={() => (playing ? toggleMix() : playPreset(preset.sounds))}
      style={({ pressed }) => [
        styles.preset,
        {
          backgroundColor: playing ? theme.tint : theme.backgroundElement,
          transform: [{ scale: pressed ? 0.97 : 1 }],
        },
      ]}>
      <View style={styles.presetIcons}>
        {preset.sounds.map((sound) => (
          <SoundIcon key={sound.id} id={sound.id} color={playing ? theme.onTint : theme.tint} size={24} />
        ))}
      </View>
      <ThemedText style={[styles.tileTitle, { color: playing ? theme.onTint : theme.text }]}>{preset.title}</ThemedText>
      <ThemedText
        type="small"
        numberOfLines={2}
        style={{ color: playing ? theme.onTint : theme.textSecondary }}>
        {preset.description}
      </ThemedText>
    </Pressable>
  );
}

function TimerChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label === 'Off' ? 'No sleep timer' : `Sleep timer, ${label}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: selected ? theme.tint : theme.backgroundSelected }]}>
      <ThemedText type="small" style={[styles.chipLabel, { color: selected ? theme.onTint : theme.text }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SoundTile({ soundscape }: { soundscape: Soundscape }) {
  const theme = useTheme();
  const { mix, mixFull, toggleSound, setSoundVolume } = usePlayback();
  const sound = mix.find((entry) => entry.id === soundscape.id);
  const active = sound !== undefined;
  const blocked = !active && mixFull;

  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: active ? theme.tint : theme.backgroundElement, opacity: blocked ? 0.45 : 1 },
      ]}>
      <Pressable
        style={styles.tilePressable}
        accessibilityRole="button"
        accessibilityState={{ selected: active, disabled: blocked }}
        accessibilityLabel={`${soundscape.title}. ${soundscape.description}`}
        accessibilityHint={active ? 'Removes this sound from your mix' : 'Adds this sound to your mix'}
        disabled={blocked}
        onPress={() => toggleSound(soundscape.id)}>
        {({ pressed }) => (
          <View style={[styles.tileBody, { transform: [{ scale: pressed ? 0.97 : 1 }] }]}>
            <SoundIcon id={soundscape.id} color={active ? theme.onTint : theme.tint} size={36} />
            <View style={styles.tileText}>
              <ThemedText
                numberOfLines={2}
                style={[styles.tileTitle, { color: active ? theme.onTint : theme.text }]}>
                {soundscape.title}
              </ThemedText>
              {/* The description and the volume bar share this fixed slot, so turning a sound on or
                  off never changes the tile's size. */}
              <View style={styles.descriptionSlot}>
                {active ? null : (
                  <ThemedText type="small" numberOfLines={3} themeColor="textSecondary">
                    {soundscape.description}
                  </ThemedText>
                )}
              </View>
            </View>
          </View>
        )}
      </Pressable>
      {sound ? (
        <View style={styles.tileSlider}>
            <VolumeSlider
            value={sound.volume}
            onChange={(volume) => setSoundVolume(soundscape.id, volume)}
            accessibilityLabel={`${soundscape.title} volume`}
            color={theme.onTint}
          />
        </View>
      ) : null}
    </View>
  );
}

/** Room for three lines of description. The volume bar sits in the same space. */
const TILE_SLOT_HEIGHT = 60;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  card: {
    borderRadius: 24,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  cardPlay: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: {
    flex: 1,
    gap: Spacing.half,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  saveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  saveInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.three,
    fontSize: 16,
  },
  clear: {
    minHeight: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timer: {
    gap: Spacing.two,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  section: {
    gap: Spacing.three,
  },
  categoryHeader: {
    gap: Spacing.half,
  },
  categoryTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.4,
  },
  presets: {
    gap: Spacing.three,
  },
  preset: {
    width: 180,
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  presetIcons: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  driftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  driftTitle: {
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  tileSlot: {
    flexGrow: 1,
  },
  tile: {
    flex: 1,
    // Icon, two lines of title and the description slot, so every tile is the same size.
    minHeight: 190,
    borderRadius: 24,
    padding: Spacing.three,
  },
  descriptionSlot: {
    height: TILE_SLOT_HEIGHT,
  },
  tileSlider: {
    position: 'absolute',
    left: Spacing.three,
    right: Spacing.three,
    bottom: Spacing.three + (TILE_SLOT_HEIGHT - 44) / 2,
  },
  tilePressable: {
    flex: 1,
  },
  tileBody: {
    flex: 1,
    gap: Spacing.three,
    justifyContent: 'space-between',
  },
  tileText: {
    gap: Spacing.half,
  },
  tileTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
});
