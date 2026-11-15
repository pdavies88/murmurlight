import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useEffectEvent, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Aura } from '@/components/brand/aura';
import { BreathOrb } from '@/components/breath-orb';
import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { CATEGORIES, findSoundscape } from '@/content/catalog';
import { logMindfulSession } from '@/lib/health';
import { MIX_PRESETS } from '@/content/presets';
import { usePlayback } from '@/context/playback-context';
import { useBreathSession } from '@/hooks/use-breath-session';
import { useTheme } from '@/hooks/use-theme';
import { BREATH_PATTERNS } from '@/lib/breathing';
import { formatClock } from '@/lib/time';

/** Step 1 lasts this long: eight slow breaths with the long-exhale pattern, give or take. */
const BREATHE_SECONDS = 120;
/** The routine always ends with a sleep timer. This is the length used when none is chosen. */
const DEFAULT_TIMER_MINUTES = 30;
const ORB_SIZE = 200;
const MAX_ORB_SHARE = 0.3;
const MAX_WIDE_ORB_SHARE = 0.4;

const SLEEP_MEDITATIONS = CATEGORIES.find((category) => category.id === 'sleep')?.meditations ?? [];
const LONG_EXHALE = BREATH_PATTERNS.find((pattern) => pattern.id === 'long-exhale') ?? BREATH_PATTERNS[0];

type Step = 'setup' | 'breathe' | 'meditate' | 'sleep';

/**
 * The wind-down routine: two minutes of slow breathing, a guided sleep meditation, then the
 * user's mix with the sleep timer. After step 1 the phone can be locked, because the mix starts
 * the moment the meditation ends.
 */
export default function WindDownScreen() {
  const theme = useTheme();
  const playback = usePlayback();
  const { track, finished, mix, mixPlaying, timerMinutes, timerRemaining, position, duration } = playback;
  const [meditationId, setMeditationId] = useState(SLEEP_MEDITATIONS[0]?.id ?? '');
  const [chosenStep, setStep] = useState<Step>('setup');
  // Step 2 ends by itself: once the meditation finishes, the mix takes over.
  const step: Step = chosenStep === 'meditate' && mixPlaying && !track ? 'sleep' : chosenStep;
  const [breatheStartedAt, setBreatheStartedAt] = useState<number | null>(null);
  const { elapsed, moment, orbStyle } = useBreathSession(LONG_EXHALE, step === 'breathe' ? breatheStartedAt : null);

  const [frame, setFrame] = useState({ width: 0, height: 0 });
  const wide = frame.width > frame.height && frame.height > 0;
  const orbSize = Math.min(
    ORB_SIZE,
    (frame.height || ORB_SIZE / MAX_ORB_SHARE) * (wide ? MAX_WIDE_ORB_SHARE : MAX_ORB_SHARE),
  );

  // An empty mix would leave step 3 silent, so the routine falls back to the first ready-made mix.
  const plannedMix = mix.length > 0 ? mix : MIX_PRESETS[0].sounds;
  const mixNames = plannedMix.map((sound) => findSoundscape(sound.id)?.title ?? sound.id).join(' + ');
  const plannedMinutes = timerMinutes ?? DEFAULT_TIMER_MINUTES;
  const meditation = SLEEP_MEDITATIONS.find((entry) => entry.id === meditationId);

  const start = () => {
    if (mix.length === 0) playback.setMixSounds(plannedMix);
    if (timerMinutes === null) playback.setTimerMinutes(DEFAULT_TIMER_MINUTES);
    const now = Date.now();
    // The Lock Screen counts down the whole routine. It switches to the real timer when the mix starts.
    const routineSeconds = BREATHE_SECONDS + (meditation?.minutes ?? 0) * 60 + plannedMinutes * 60;
    playback.setPlannedSleepTimer({
      mix: `Wind down, then ${mixNames}`,
      startedAt: now,
      endsAt: now + routineSeconds * 1000,
    });
    setBreatheStartedAt(now);
    setStep('breathe');
  };

  const startMeditation = () => {
    if (step === 'breathe' && breatheStartedAt !== null) logMindfulSession(breatheStartedAt, Date.now());
    playback.playMeditation(meditationId);
    playback.setMixAfterMeditation(true);
    setStep('meditate');
  };

  const startSleep = () => {
    playback.stop();
    playback.playMix();
    setStep('sleep');
  };

  // Siri's "Wind down" opens this screen with ?start= and the routine begins at once.
  const { start: startParam } = useLocalSearchParams<{ start?: string }>();
  const startFromSiri = useEffectEvent(() => {
    if (chosenStep === 'setup') start();
  });
  useEffect(() => {
    if (!startParam) return;
    // After this render, so the screen has finished opening.
    const timeout = setTimeout(() => startFromSiri(), 0);
    return () => clearTimeout(timeout);
  }, [startParam]);

  // Step 1 moves on by itself once the breathing time is up.
  const onBreatheDone = useEffectEvent(startMeditation);
  useEffect(() => {
    if (step !== 'breathe' || breatheStartedAt === null) return;
    const timeout = setTimeout(
      () => onBreatheDone(),
      Math.max(0, breatheStartedAt + BREATHE_SECONDS * 1000 - Date.now()),
    );
    return () => clearTimeout(timeout);
  }, [step, breatheStartedAt]);

  // Leaving early stops the routine. A mix that is already playing for sleep keeps playing.
  const onLeave = useEffectEvent(() => {
    playback.setPlannedSleepTimer(null);
    if (step === 'breathe' || step === 'meditate') {
      playback.setMixAfterMeditation(false);
      if (track) playback.stop();
    }
  });
  useEffect(() => () => onLeave(), []);

  const stepNumber = step === 'breathe' ? 1 : step === 'meditate' ? 2 : 3;

  return (
    <ThemedView style={styles.container}>
      <Aura
        key={`${frame.width}x${frame.height}`}
        orbs={[
          { id: 'wind-primary', color: theme.auraPrimary, size: 520, x: '50%', y: '25%', period: 10_000 },
          { id: 'wind-secondary', color: theme.auraSecondary, size: 360, x: '15%', y: '80%', period: 13_000 },
        ]}
      />
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={styles.container}
        onLayout={(event: LayoutChangeEvent) => {
          const { width, height } = event.nativeEvent.layout;
          setFrame({ width, height });
        }}>
        <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
          {step === 'setup' ? (
            <View style={styles.column}>
              <View style={styles.header}>
                <ThemedText type="subtitle" accessibilityRole="header">
                  Wind down
                </ThemedText>
                <ThemedText themeColor="textSecondary">
                  Three steps from awake to asleep. After the first step you can lock your phone. The rest plays by
                  itself.
                </ThemedText>
              </View>

              <StepRow number={1} title="Breathe" detail="Two minutes of slow breathing, with a long breath out." />
              <View style={styles.stepGroup}>
                <StepRow number={2} title="Meditate" detail="Choose a guided sleep meditation." />
                <View style={styles.choices} accessibilityRole="radiogroup">
                  {SLEEP_MEDITATIONS.map((entry) => {
                    const selected = entry.id === meditationId;
                    return (
                      <Pressable
                        key={entry.id}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        accessibilityLabel={`${entry.title}, ${entry.minutes} minutes`}
                        onPress={() => setMeditationId(entry.id)}
                        style={[styles.choice, { backgroundColor: selected ? theme.tint : theme.backgroundElement }]}>
                        <ThemedText style={[styles.choiceTitle, { color: selected ? theme.onTint : theme.text }]}>
                          {entry.minutes} min
                        </ThemedText>
                        <ThemedText type="small" style={{ color: selected ? theme.onTint : theme.textSecondary }}>
                          {entry.title}
                        </ThemedText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              <StepRow
                number={3}
                title="Sleep"
                detail={`${mixNames} plays for ${plannedMinutes} minutes, then fades out. Change the mix and timer on the Sounds tab.`}
              />

              <Button title="Start wind-down" onPress={start} />
            </View>
          ) : (
            <View style={[styles.running, wide && styles.runningWide]}>
              <View style={[styles.column, wide && styles.columnWide]}>
                <ThemedText themeColor="textSecondary" style={styles.centered} accessibilityRole="header">
                  Step {stepNumber} of 3
                </ThemedText>
                {step === 'breathe' ? <BreathOrb size={orbSize} style={orbStyle} /> : null}
                <View style={styles.phase} accessibilityLiveRegion="polite">
                  <ThemedText style={styles.phaseLabel}>
                    {step === 'breathe' ? moment.phase.label : step === 'meditate' ? meditation?.title : 'Sleep well'}
                  </ThemedText>
                  <ThemedText themeColor="textSecondary" style={styles.centered}>
                    {step === 'breathe'
                      ? `${moment.secondsLeft} · ${formatClock(BREATHE_SECONDS - elapsed)} left`
                      : step === 'meditate'
                        ? finished
                          ? 'Starting your mix…'
                          : `${formatClock(position)} of ${formatClock(duration)} · then ${mixNames}`
                        : timerRemaining !== null
                          ? `${mixNames} · fades out in ${formatClock(timerRemaining)}`
                          : mixNames}
                  </ThemedText>
                </View>
              </View>
              <View style={[styles.column, wide && styles.columnWide]}>
                {step === 'breathe' ? (
                  <Button title="Skip to the meditation" variant="secondary" onPress={startMeditation} />
                ) : null}
                {step === 'meditate' ? (
                  <Button title="Skip to the mix" variant="secondary" onPress={startSleep} />
                ) : null}
                {step === 'sleep' ? (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.centered}>
                    You can lock your phone. The timer also shows on the Lock Screen.
                  </ThemedText>
                ) : null}
                <Button
                  title={step === 'sleep' ? 'Done' : 'End wind-down'}
                  variant={step === 'sleep' ? 'primary' : 'secondary'}
                  onPress={() => router.back()}
                />
              </View>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StepRow({ number, title, detail }: { number: number; title: string; detail: string }) {
  const theme = useTheme();
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepNumber, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText style={[styles.stepNumberText, { color: theme.tint }]}>{number}</ThemedText>
      </View>
      <View style={styles.stepText}>
        <ThemedText style={styles.stepTitle}>{title}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {detail}
        </ThemedText>
      </View>
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
    justifyContent: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  column: {
    gap: Spacing.four,
  },
  columnWide: {
    flex: 1,
  },
  running: {
    gap: Spacing.five,
  },
  runningWide: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  header: {
    gap: Spacing.two,
  },
  stepGroup: {
    gap: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
  },
  stepText: {
    flex: 1,
    gap: Spacing.half,
  },
  stepTitle: {
    fontSize: 17,
    lineHeight: 22,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
  },
  choices: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingLeft: 32 + Spacing.three,
  },
  choice: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    padding: Spacing.two + Spacing.one,
    gap: Spacing.half,
    justifyContent: 'center',
  },
  choiceTitle: {
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
  },
  phase: {
    alignItems: 'center',
    gap: Spacing.one,
  },
  phaseLabel: {
    fontSize: 28,
    lineHeight: 34,
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
    letterSpacing: -0.6,
    textAlign: 'center',
  },
  centered: {
    textAlign: 'center',
  },
});
