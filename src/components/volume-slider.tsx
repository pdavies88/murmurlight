import { Host, Slider } from '@expo/ui';
import { accessibilityLabel as swiftAccessibilityLabel } from '@expo/ui/swift-ui/modifiers';
import { Platform, StyleSheet } from 'react-native';

import { clampVolume } from '@/lib/mix';

type VolumeSliderProps = {
  /** 0 to 1. */
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** The color of the filled part and the thumb. */
  color: string;
};

/**
 * A native volume slider. It works inside scroll views, and VoiceOver and TalkBack can adjust it
 * with a swipe.
 */
export function VolumeSlider({ value, onChange, accessibilityLabel, color }: VolumeSliderProps) {
  return (
    <Host matchContents={{ vertical: true }} seedColor={color} style={styles.host}>
      <Slider
        value={value}
        onValueChange={(next) => onChange(clampVolume(next))}
        modifiers={Platform.OS === 'ios' ? [swiftAccessibilityLabel(accessibilityLabel)] : undefined}
      />
    </Host>
  );
}

const styles = StyleSheet.create({
  host: {
    minHeight: 44,
    justifyContent: 'center',
  },
});
