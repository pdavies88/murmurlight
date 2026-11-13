import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Hero, useHeroHeight } from '@/components/brand/hero';
import { PlayPauseIcon } from '@/components/play-pause-icon';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, DisplayFont, MaxContentWidth, Spacing } from '@/constants/theme';
import { CATEGORIES, type Meditation } from '@/content/catalog';
import { usePlayback } from '@/context/playback-context';
import { useTheme } from '@/hooks/use-theme';

export default function MeditateScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const heroHeight = useHeroHeight();

  // The hero runs under the status bar. Once it scrolls away, fade in a solid strip behind the
  // status bar so the list doesn't collide with the clock.
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const statusBarStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [heroHeight - 80, heroHeight], [0, 1], 'clamp'),
  }));

  return (
    <ThemedView style={styles.container}>
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{ paddingBottom: BottomTabInset + Spacing.four }}>
        <Hero />
        {/* Keeps the list clear of the Dynamic Island and home indicator in landscape. */}
        <View
          style={[
            styles.content,
            { paddingLeft: Spacing.four + insets.left, paddingRight: Spacing.four + insets.right },
          ]}>
          <WindDownCard />
          {CATEGORIES.map((category) => (
            <View key={category.id} style={styles.category}>
              <View style={styles.categoryHeader}>
                <ThemedText style={styles.categoryTitle}>{category.title}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {category.description}
                </ThemedText>
              </View>
              {category.meditations.map((meditation) => (
                <SessionRow key={meditation.id} meditation={meditation} />
              ))}
            </View>
          ))}
        </View>
      </Animated.ScrollView>
      <Animated.View
        pointerEvents="none"
        style={[styles.statusBar, { height: insets.top, backgroundColor: theme.background }, statusBarStyle]}
      />
    </ThemedView>
  );
}

/** The way into the wind-down routine, at the top of the list so it's the first thing people try. */
function WindDownCard() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Wind down. Breathe, meditate, then fall asleep to your mix."
      accessibilityHint="Opens the wind-down routine"
      onPress={() => router.push('/wind-down')}>
      {({ pressed }) => (
        <View
          style={[styles.windDown, { backgroundColor: theme.tint, transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <View style={styles.rowText}>
            <ThemedText style={[styles.windDownTitle, { color: theme.onTint }]}>Wind down</ThemedText>
            <ThemedText type="small" style={{ color: theme.onTint, opacity: 0.85 }}>
              Breathe, meditate, then fall asleep to your mix. One tap, and you can lock your phone.
            </ThemedText>
          </View>
          <View style={[styles.play, { backgroundColor: theme.onTint }]}>
            <PlayPauseIcon playing={false} color={theme.tint} size={16} />
          </View>
        </View>
      )}
    </Pressable>
  );
}

function SessionRow({ meditation }: { meditation: Meditation }) {
  const theme = useTheme();
  const { track, isPlaying, playMeditation } = usePlayback();
  const isCurrent = track?.id === meditation.id;

  const open = () => {
    if (!isCurrent) playMeditation(meditation.id);
    router.push('/player');
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${meditation.title}, ${meditation.minutes} minutes. ${meditation.description}`}
      onPress={open}>
      {({ pressed }) => (
        <ThemedView
          type="backgroundElement"
          style={[styles.row, { transform: [{ scale: pressed ? 0.98 : 1 }] }]}>
          <View style={[styles.minutes, { backgroundColor: theme.backgroundSelected }]}>
            <ThemedText style={[styles.minutesNumber, { color: theme.tint }]}>{meditation.minutes}</ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.minutesLabel}>
              MIN
            </ThemedText>
          </View>
          <View style={styles.rowText}>
            <ThemedText style={styles.rowTitle}>{meditation.title}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" numberOfLines={2}>
              {meditation.description}
            </ThemedText>
          </View>
          <View style={[styles.play, { backgroundColor: theme.tint }]}>
            <PlayPauseIcon playing={isCurrent && isPlaying} color={theme.onTint} size={16} />
          </View>
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statusBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  },
  content: {
    paddingTop: Spacing.two,
    gap: Spacing.five,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  category: {
    gap: Spacing.two + Spacing.one,
  },
  categoryHeader: {
    gap: Spacing.half,
    marginBottom: Spacing.one,
  },
  categoryTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three - Spacing.one,
    borderRadius: 20,
  },
  windDown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: 24,
  },
  windDownTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
    letterSpacing: -0.4,
  },
  minutes: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  minutesNumber: {
    fontSize: 18,
    lineHeight: 20,
    fontFamily: DisplayFont.extraBold,
    fontWeight: 'normal',
  },
  minutesLabel: {
    fontSize: 9,
    lineHeight: 12,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: 0.8,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: DisplayFont.bold,
    fontWeight: 'normal',
    letterSpacing: -0.2,
  },
  play: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
