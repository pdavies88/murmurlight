import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { type AnimatedStyle } from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/** The lit sphere the breathing pacer grows and shrinks. Decorative, so screen readers skip it. */
export function BreathOrb({ size, style }: { size: number; style: StyleProp<AnimatedStyle<ViewStyle>> }) {
  const theme = useTheme();
  return (
    <View
      style={[styles.ring, { width: size, height: size, borderColor: theme.backgroundSelected }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Animated.View style={style}>
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="breath-orb" cx="38%" cy="32%" r="75%">
              <Stop offset="0" stopColor="#FFFFFF" />
              <Stop offset="0.45" stopColor={theme.auraSecondary} />
              <Stop offset="1" stopColor={theme.tint} />
            </RadialGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={size / 2 - 6} fill="url(#breath-orb)" />
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: 999,
  },
});
