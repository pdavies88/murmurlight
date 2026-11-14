import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BreathOrb } from '@/components/breath-orb';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useBreathSession } from '@/hooks/use-breath-session';
import { BREATH_PATTERNS, type BreathPattern } from '@/lib/breathing';

/** The pacer orb's full size, before it shrinks to fit short screens. */
const ORB_SIZE = 240;
/** In portrait the orb never takes more than this share of the screen's height, so the controls fit. */
const MAX_ORB_SHARE = 0.32;
/** Room under the orb in landscape for the phase name and countdown. */
const PHASE_HEIGHT = 72;
/** Screens shorter than this, such as a phone in landscape, drop the instructions to fit. */
const SHORT_SCREEN = 600;

/** A breathing pacer: an orb that grows and shrinks to a chosen pattern, with a countdown, tones and haptics. */
export default function BreatheScreen() {
  const [patternId, setPatternId] = useState(BREATH_PATTERNS[0].id);
  const pattern = BREATH_PATTERNS.find((entry) => entry.id === patternId) ?? BREATH_PATTERNS[0];
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [withSound, setWithSound] = useState(true);
  const { running, moment, orbStyle } = useBreathSession(pattern, startedAt, withSound);

  // Measured from the screen itself. Wider than tall, such as a phone in landscape, puts the
  // controls beside the orb and fits everything on one screen with no scrolling.
  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const wide = frame.width > frame.height && frame.height > 0;
  const short = frame.height > 0 && frame.height < SHORT_SCREEN;
  const orbSize = wide
    ? Math.min(ORB_SIZE, frame.height - BottomTabInset - Spacing.four * 2 - PHASE_HEIGHT - Spacing.three)
    : Math.min(ORB_SIZE, (frame.height || ORB_SIZE / MAX_ORB_SHARE) * MAX_ORB_SHARE);

  const orb = (
    <View style={styles.orbColumn}>
      <BreathOrb size={orbSize} style={orbStyle} />
      <View style={styles.phase} accessibilityLiveRegion="polite">
        <ThemedText style={styles.phaseLabel}>{running ? moment.phase.label : 'Ready when you are'}</ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.count}>
          {running ? `${moment.secondsLeft}` : pattern.summary}
        </ThemedText>
      </View>
    </View>
  );

  const controls = (
    <Controls
      pattern={pattern}
      running={running}
      breathNumber={moment.cycles + 1}
      onPattern={setPatternId}
      withSound={withSound}
      onSound={setWithSound}
      onStart={() => setStartedAt(Date.now())}
      onStop={() => setStartedAt(null)}
    />
  );

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView
        edges={['top', 'left', 'right']}
        style={styles.container}
        onLayout={(event: LayoutChangeEvent) => {
          const { width, height } = event.nativeEvent.layout;
          setFrame({ width, height });
        }}>
        {wide ? (
          <View style={[styles.wide, { paddingBottom: BottomTabInset + Spacing.four }]}>
            <View style={styles.half}>{orb}</View>
            <View style={styles.half}>
              <Header compact={short} />
              {controls}
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}>
            <Header />
            {orb}
            {controls}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function Controls({
  pattern,
  running,
  breathNumber,
  onPattern,
  withSound,
  onSound,
  onStart,
  onStop,
}: {
  pattern: BreathPattern;
  running: boolean;
  breathNumber: number;
  onPattern: (id: string) => void;
  withSound: boolean;
  onSound: (on: boolean) => void;
  onStart: () => void;
  onStop: () => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.controls}>
      <View style={styles.patterns} accessibilityRole="radiogroup">
        {BREATH_PATTERNS.map((entry) => {
          const selected = entry.id === pattern.id;
          return (
            <Pressable
              key={entry.id}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled: running }}
              accessibilityLabel={`${entry.title}, ${entry.summary.replaceAll(' · ', ', ')} seconds. ${entry.description}`}
              disabled={running}
              onPress={() => onPattern(entry.id)}
              style={[
                styles.pattern,
                {
                  backgroundColor: selected ? theme.tint : theme.backgroundElement,
                  opacity: running && !selected ? 0.45 : 1,
                },
              ]}>
              <ThemedText
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={[styles.patternTitle, { color: selected ? theme.onTint : theme.text }]}>
                {entry.title}
              </ThemedText>
              <ThemedText
                type="small"
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.75}
                style={{ color: selected ? theme.onTint : theme.textSecondary }}>
                {entry.summary}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
      <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
        {running ? `Breath ${breathNumber}` : pattern.description}
      </ThemedText>
      <View style={styles.soundRow}>
        <ThemedText style={styles.soundLabel}>Soft tones</ThemedText>
        <Switch
          accessibilityLabel="Soft tones at each change"
          value={withSound}
          onValueChange={onSound}
          trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
        />
      </View>
      <Button
        title={running ? 'Stop' : 'Start breathing'}
        variant={running ? 'secondary' : 'primary'}
        onPress={running ? onStop : onStart}
      />
    </View>
  );
}

/** On short screens there's no room for the instructions beside the orb, so only the title shows. */
function Header({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.header}>
      <ThemedText type="subtitle" accessibilityRole="header">
        Breathe
      </ThemedText>
      {compact ? null : (
        <ThemedText themeColor="textSecondary">
          Follow the orb. It grows as you breathe in and shrinks as you breathe out. A soft tone and a tap mark each
          change, so you can close your eyes.
        </ThemedText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: Spacing.four,
    gap: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  wide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    gap: Spacing.five,
  },
  half: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.three,
  },
  orbColumn: {
    alignItems: 'center',
    gap: Spacing.three,
  },
  controls: {
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.two,
  },
  phase: {
    alignItems: 'center',
    gap: Spacing.half,
  },
  phaseLabel: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  count: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    fontVariant: ['tabular-nums'],
  },
  patterns: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  pattern: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    padding: Spacing.two + Spacing.one,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.half,
  },
  patternTitle: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    textAlign: 'center',
  },
  soundRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  soundLabel: {
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  centered: {
    textAlign: 'center',
  },
});
