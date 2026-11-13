import { Pressable, ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PlayPauseIcon } from '@/components/play-pause-icon';
import { SoundIcon } from '@/components/sound-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { VolumeSlider } from '@/components/volume-slider';
import { BottomTabInset, DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { SOUNDSCAPES, findSoundscape, type Soundscape } from '@/content/catalog';
import { MIX_PRESETS, type MixPreset } from '@/content/presets';
import { usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';
import { MAX_MIX_SOUNDS, TIMER_MINUTES } from '@/lib/mix';
import { formatClock } from '@/lib/time';

/** Windows at least this wide, such as an unfolded iPhone Duo or a phone in landscape, get three columns. */
const WIDE_WINDOW = 600;

/** The sound mixer: layer sounds, set each volume, and let a sleep timer fade them out. */
export default function SoundsScreen() {
  const window = useWindowDimensions();
  const tileWidth = window.width >= WIDE_WINDOW ? '30%' : '47%';

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
          <View style={styles.grid}>
            {SOUNDSCAPES.map((soundscape) => (
              <View key={soundscape.id} style={[styles.tileSlot, { width: tileWidth }]}>
                <SoundTile soundscape={soundscape} />
              </View>
            ))}
          </View>
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
  } = usePlayback();
  const empty = mix.length === 0;
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
          <Pressable accessibilityRole="button" accessibilityLabel="Clear mix" onPress={clearMix} style={styles.clear}>
            <ThemedText type="small" style={{ color: theme.tint }}>
              Clear
            </ThemedText>
          </Pressable>
        )}
      </View>

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

function PresetCard({ preset }: { preset: MixPreset }) {
  const theme = useTheme();
  const { mix, mixPlaying, playPreset } = usePlayback();
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
      accessibilityHint="Replaces your mix with this one and plays it"
      onPress={() => playPreset(preset.sounds)}
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
              <ThemedText style={[styles.tileTitle, { color: active ? theme.onTint : theme.text }]}>
                {soundscape.title}
              </ThemedText>
              {active ? null : (
                <ThemedText type="small" numberOfLines={3} themeColor="textSecondary">
                  {soundscape.description}
                </ThemedText>
              )}
            </View>
          </View>
        )}
      </Pressable>
      {sound ? (
        <VolumeSlider
          value={sound.volume}
          onChange={(volume) => setSoundVolume(soundscape.id, volume)}
          accessibilityLabel={`${soundscape.title} volume`}
          color={theme.onTint}
        />
      ) : null}
    </View>
  );
}

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
    minHeight: 160,
    borderRadius: 24,
    padding: Spacing.three,
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
