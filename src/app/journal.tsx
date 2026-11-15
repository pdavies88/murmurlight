import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { MoonDots } from '@/components/night-cards';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { findSoundscape } from '@/content/catalog';
import { deleteJournalEntry, useJournal } from '@/lib/journal-store';
import { MIN_NIGHTS_FOR_INSIGHT, RATING_LABELS, journalInsights, type JournalEntry } from '@/lib/sleep-journal';

function soundNames(ids: string[]): string {
  return ids.map((id) => findSoundscape(id)?.title ?? id).join(' + ');
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** The sleep journal: the nights the user rated, and which sounds go with their best sleep. */
export default function JournalScreen() {
  const journal = useJournal();
  const { average, bestSounds } = journalInsights(journal.entries);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
        <ThemedView type="backgroundElement" style={styles.card}>
          <ThemedText style={styles.cardTitle}>Your sleep</ThemedText>
          {average === null ? (
            <ThemedText themeColor="textSecondary">
              Each morning, the Meditate tab asks how you slept. Your answers appear here, with the sounds that played
              that night.
            </ThemedText>
          ) : (
            <>
              <View style={styles.averageRow}>
                <ThemedText style={styles.average}>{average.toFixed(1)}</ThemedText>
                <View style={styles.averageText}>
                  <MoonDots rating={Math.round(average)} />
                  <ThemedText type="small" themeColor="textSecondary">
                    Average over {journal.entries.length} {journal.entries.length === 1 ? 'night' : 'nights'}
                  </ThemedText>
                </View>
              </View>
            </>
          )}
        </ThemedView>

        {average !== null ? (
          <ThemedView type="backgroundElement" style={styles.card}>
            <ThemedText style={styles.cardTitle}>Sounds on your best nights</ThemedText>
            {bestSounds.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                Play a mix at night and rate the morning after. Once a sound has played on {MIN_NIGHTS_FOR_INSIGHT} rated
                nights, it shows here.
              </ThemedText>
            ) : (
              bestSounds.map((sound) => (
                <View key={sound.id} style={styles.soundRow}>
                  <ThemedText style={styles.soundName}>{findSoundscape(sound.id)?.title ?? sound.id}</ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {sound.average.toFixed(1)} over {sound.nights} nights
                  </ThemedText>
                </View>
              ))
            )}
          </ThemedView>
        ) : null}

        {journal.entries.length > 0 ? (
          <View style={styles.list}>
            <ThemedText style={styles.cardTitle}>Nights</ThemedText>
            {journal.entries.map((entry) => (
              <NightRow key={entry.date} entry={entry} />
            ))}
            <ThemedText type="small" themeColor="textSecondary">
              Touch and hold a night to delete it.
            </ThemedText>
          </View>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function NightRow({ entry }: { entry: JournalEntry }) {
  const confirmDelete = () =>
    Alert.alert('Delete this night?', formatDate(entry.date), [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteJournalEntry(entry.date) },
    ]);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${formatDate(entry.date)}. Slept ${RATING_LABELS[entry.rating].toLowerCase()}.`}
      accessibilityHint="Touch and hold to delete"
      onLongPress={confirmDelete}>
      <ThemedView type="backgroundElement" style={styles.night}>
        <View style={styles.nightTop}>
          <ThemedText style={styles.soundName}>{formatDate(entry.date)}</ThemedText>
          <View style={styles.nightRating}>
            <MoonDots rating={entry.rating} />
            <ThemedText type="small" themeColor="textSecondary">
              {RATING_LABELS[entry.rating]}
            </ThemedText>
          </View>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          {entry.soundIds.length > 0 ? soundNames(entry.soundIds) : 'No sounds that night'}
        </ThemedText>
      </ThemedView>
    </Pressable>
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
  card: {
    padding: Spacing.three,
    borderRadius: 24,
    gap: Spacing.three,
  },
  cardTitle: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.3,
  },
  averageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  average: {
    fontSize: 44,
    lineHeight: 50,
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
  },
  averageText: {
    gap: Spacing.one,
  },
  soundRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  soundName: {
    fontFamily: DisplayFont.semiBold,
    fontWeight: 'normal',
  },
  list: {
    gap: Spacing.two,
  },
  night: {
    padding: Spacing.three,
    borderRadius: 20,
    gap: Spacing.one,
  },
  nightTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nightRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});
