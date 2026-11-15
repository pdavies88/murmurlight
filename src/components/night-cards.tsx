import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisplayFont, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WAKE_TIMES, useSettings } from '@/lib/app-settings';
import { rateLastNight, useJournal } from '@/lib/journal-store';
import { formatReminder } from '@/lib/mix';
import { RATING_LABELS, shouldAskToday, type SleepRating } from '@/lib/sleep-journal';
import { setWakeAlarm, wakeRingsOnSilent } from '@/lib/wake-alarm';

const RATINGS: SleepRating[] = [1, 2, 3, 4, 5];

/** A row of round choices, such as times. One can be selected. */
export function ChoiceChips<T extends string | number | null>({
  options,
  selected,
  label,
  accessibilityLabel,
  onChoose,
}: {
  options: T[];
  selected: T;
  label: (option: T) => string;
  accessibilityLabel: (option: T) => string;
  onChoose: (option: T) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.chips} accessibilityRole="radiogroup">
      {options.map((option) => {
        const isSelected = option === selected;
        return (
          <Pressable
            key={String(option)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={accessibilityLabel(option)}
            onPress={() => onChoose(option)}
            style={[styles.chip, { backgroundColor: isSelected ? theme.tint : theme.backgroundSelected }]}>
            <ThemedText type="small" style={[styles.chipLabel, { color: isSelected ? theme.onTint : theme.text }]}>
              {label(option)}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Each morning, a one-tap question about last night. It hides once answered. */
export function SleepCheckIn() {
  const theme = useTheme();
  const journal = useJournal();
  // Read the clock once per render of the home tab. The card only matters in the morning.
  const [now] = useState(() => Date.now());
  const [justRated, setJustRated] = useState<SleepRating | null>(null);

  if (justRated !== null) {
    return (
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText style={styles.title}>Saved. You slept {RATING_LABELS[justRated].toLowerCase()}.</ThemedText>
        <Pressable accessibilityRole="link" onPress={() => router.push('/journal')} hitSlop={8}>
          <ThemedText type="small" style={[styles.link, { color: theme.tint }]}>
            See your sleep journal
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }
  if (!shouldAskToday(journal, now)) return null;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.text}>
        <ThemedText style={styles.title}>Good morning. How did you sleep?</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Your answers show which sounds help you sleep best. They stay on this phone.
        </ThemedText>
      </View>
      <View style={styles.ratings}>
        {RATINGS.map((rating) => (
          <Pressable
            key={rating}
            accessibilityRole="button"
            accessibilityLabel={`I slept ${RATING_LABELS[rating].toLowerCase()}`}
            onPress={() => {
              rateLastNight(rating);
              setJustRated(rating);
            }}
            style={({ pressed }) => [
              styles.rating,
              { backgroundColor: theme.backgroundSelected, transform: [{ scale: pressed ? 0.95 : 1 }] },
            ]}>
            <MoonDots rating={rating} />
            <ThemedText type="small" style={styles.ratingLabel} numberOfLines={1} adjustsFontSizeToFit>
              {RATING_LABELS[rating]}
            </ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

/** Filled dots for a rating, out of five. */
export function MoonDots({ rating }: { rating: number }) {
  const theme = useTheme();
  return (
    <View style={styles.dots} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {RATINGS.map((step) => (
        <View
          key={step}
          style={[styles.dot, { backgroundColor: step <= rating ? theme.tint : theme.border }]}
        />
      ))}
    </View>
  );
}

/** The daily gentle wake alarm. */
export function GentleWake() {
  const { wakeMinutes } = useSettings();
  const choose = async (minutes: number | null) => {
    const ok = await setWakeAlarm(minutes);
    if (!ok && minutes !== null) {
      Alert.alert('Alarms are off', 'To use the gentle wake alarm, allow alarms and notifications for this app in Settings.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void Linking.openSettings() },
      ]);
    }
  };
  const options: (number | null)[] = [null, ...WAKE_TIMES];
  const detail = wakeRingsOnSilent()
    ? 'It rings even when your phone is on silent.'
    : 'Keep your ring switch on, or it plays silently.';

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.text}>
        <ThemedText style={styles.title}>Gentle wake</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {wakeMinutes === null
            ? 'Wake to birdsong and a soft chord that rise slowly from silence.'
            : `Every morning at ${formatReminder(wakeMinutes)}. ${detail}`}
        </ThemedText>
      </View>
      <ChoiceChips
        options={options}
        selected={wakeMinutes}
        label={(minutes) => (minutes === null ? 'Off' : formatReminder(minutes).replace(' AM', ''))}
        accessibilityLabel={(minutes) => (minutes === null ? 'No wake alarm' : `Wake at ${formatReminder(minutes)}`)}
        onChoose={(minutes) => void choose(minutes)}
      />
    </ThemedView>
  );
}

/** The way into the sleep journal. */
export function JournalRow() {
  const theme = useTheme();
  const journal = useJournal();
  const nights = journal.entries.length;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens your sleep journal"
      onPress={() => router.push('/journal')}>
      {({ pressed }) => (
        <ThemedView
          type="backgroundElement"
          style={[styles.card, styles.row, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <View style={styles.text}>
            <ThemedText style={styles.title}>Sleep journal</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {nights === 0
                ? 'Rate each night and see which sounds help you sleep.'
                : `${nights} ${nights === 1 ? 'night' : 'nights'} rated. See what helps you sleep.`}
            </ThemedText>
          </View>
          <ThemedText style={[styles.chevron, { color: theme.tint }]}>›</ThemedText>
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: 24,
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
  title: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  link: {
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  chevron: {
    fontSize: 28,
    lineHeight: 30,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: Spacing.three,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipLabel: {
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  ratings: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  rating: {
    flex: 1,
    minHeight: 64,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  ratingLabel: {
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});
