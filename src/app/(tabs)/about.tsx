import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '@/components/brand/logo-mark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { APP_NAME, PRIVACY_POLICY_URL, SUPPORT_EMAIL, SUPPORT_URL } from '@/constants/brand';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSettings } from '@/lib/app-settings';
import { healthAvailable, setLogToHealth } from '@/lib/health';

const FACTS = [
  {
    title: 'Everything is free',
    body: 'The sound mixer, the sleep timer, the breathing pacer and 15 guided meditations. No accounts, no subscriptions and no ads.',
  },
  {
    title: 'Build your own mix',
    body: 'Layer up to 4 of the 24 sounds, including binaural beats, and set the volume of each. Your mix is saved on this phone, and a sleep timer can fade it out.',
  },
  {
    title: 'Works completely offline',
    body: 'All audio is built into the app. It works in airplane mode, and the app never connects to the internet.',
  },
  {
    title: 'Plays with your screen locked',
    body: 'Start a meditation or a sound, then lock your phone. Use the lock screen controls to pause or stop.',
  },
  {
    title: 'Your privacy',
    body: 'The app collects no data. Your mixes and sleep journal stay on this phone. If you turn on Apple Health, mindful minutes go only to the Health app on this phone.',
  },
  {
    title: 'A gentle note',
    body: 'These meditations are for relaxation and general wellbeing. They are not medical advice or treatment.',
  },
];

export default function AboutScreen() {
  const version = Constants.expoConfig?.version ?? '';

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: BottomTabInset + Spacing.four }]}>
          <View style={styles.header}>
            <LogoMark size={80} />
            <ThemedText type="subtitle">{APP_NAME}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              Version {version}
            </ThemedText>
          </View>

          {healthAvailable() ? <HealthRow /> : null}

          {FACTS.map((fact) => (
            <ThemedView key={fact.title} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{fact.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {fact.body}
              </ThemedText>
            </ThemedView>
          ))}

          <LinkRow title="Privacy policy" onPress={() => WebBrowser.openBrowserAsync(PRIVACY_POLICY_URL)} />
          <LinkRow title="Help and support" onPress={() => WebBrowser.openBrowserAsync(SUPPORT_URL)} />
          <LinkRow
            title="Contact"
            subtitle={SUPPORT_EMAIL}
            onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}`)}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.note}>
            These links open in your browser and need an internet connection. The app itself never does.
          </ThemedText>

          <ThemedText type="small" themeColor="textSecondary" style={styles.credits}>
            Meditation voice generated with the open-source Qwen3-TTS text-to-speech model
            (Apache 2.0). The music box lullaby is Brahms’ Lullaby, in the public domain. The guitar lullaby is an original tune. All sounds and music were synthesized
            for this app.
          </ThemedText>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/** Turns mindful minutes in Apple Health on or off. */
function HealthRow() {
  const theme = useTheme();
  const { logToHealth } = useSettings();
  const toggle = async (on: boolean) => {
    const granted = await setLogToHealth(on);
    if (on && !granted) {
      Alert.alert(
        'Apple Health is off',
        'To save mindful minutes, open the Health app, go to Sharing, then Apps, and allow Murmurlight.',
      );
    }
  };
  return (
    <ThemedView type="backgroundElement" style={[styles.link, styles.healthRow]}>
      <View style={styles.flex}>
        <ThemedText type="smallBold">Apple Health</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          Save meditations and breathing sessions of a minute or more as mindful minutes.
        </ThemedText>
      </View>
      <Switch
        accessibilityLabel="Save mindful minutes to Apple Health"
        value={logToHealth}
        onValueChange={(on) => void toggle(on)}
        trackColor={{ true: theme.tint, false: theme.backgroundSelected }}
      />
    </ThemedView>
  );
}

function LinkRow({ title, subtitle, onPress }: { title: string; subtitle?: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="link" onPress={onPress}>
      {({ pressed }) => (
        <ThemedView type="backgroundElement" style={[styles.link, { opacity: pressed ? 0.7 : 1 }]}>
          <View style={styles.flex}>
            <ThemedText type="smallBold" style={{ color: theme.tint }}>
              {title}
            </ThemedText>
            {subtitle ? (
              <ThemedText type="small" themeColor="textSecondary">
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          <ThemedText themeColor="textSecondary">›</ThemedText>
        </ThemedView>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: Spacing.four,
    gap: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
  },
  card: {
    borderRadius: 20,
    padding: Spacing.three,
    gap: Spacing.one,
  },
  healthRow: {
    gap: Spacing.three,
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  note: {
    paddingHorizontal: Spacing.one,
  },
  credits: {
    textAlign: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
});
