import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { clampVolume } from '@/lib/mix';

type VolumeSliderProps = {
  /** 0 to 1. */
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** The color of the filled part and the thumb. */
  color: string;
};

const THUMB = 26;
/** VoiceOver and TalkBack change the volume in steps of this size. */
const STEP = 0.1;

/**
 * A volume slider drawn with plain React Native views, so it lays out with the rest of its tile.
 * The native SwiftUI slider it replaces could end up below its tile after the list re-rendered
 * while it was scrolled off screen.
 *
 * Tap or drag sideways to set the volume. A vertical drag still scrolls the list, because the
 * scroll view takes the touch over. VoiceOver and TalkBack adjust it with a swipe up or down.
 */
export function VolumeSlider({ value, onChange, accessibilityLabel, color }: VolumeSliderProps) {
  const [width, setWidth] = useState(0);

  // Sets the volume from where the finger is, measured from this view's left edge.
  const follow = (event: GestureResponderEvent) => {
    const usable = width - THUMB;
    if (usable <= 0) return;
    onChange(clampVolume((event.nativeEvent.locationX - THUMB / 2) / usable));
  };

  const percent = Math.round(value * 100);
  const thumbLeft = Math.max(0, (width - THUMB) * value);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percent, text: `${percent}%` }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => {
        const delta = event.nativeEvent.actionName === 'increment' ? STEP : -STEP;
        onChange(clampVolume(value + delta));
      }}
      // Touches land on this view, never on the track or thumb, so locationX is measured from its left edge.
      pointerEvents="box-only"
      onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
      style={styles.container}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderMove={follow}
      onResponderRelease={follow}
      // Let the list scroll when the drag is vertical.
      onResponderTerminationRequest={() => true}>
      <View style={[styles.track, { backgroundColor: color, opacity: 0.3 }]} />
      <View style={[styles.fill, { backgroundColor: color, width: thumbLeft + THUMB / 2 }]} />
      <View style={[styles.thumb, { backgroundColor: color, left: thumbLeft }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 44,
    width: '100%',
    justifyContent: 'center',
  },
  track: {
    position: 'absolute',
    left: THUMB / 2,
    right: THUMB / 2,
    height: 6,
    borderRadius: 3,
  },
  fill: {
    position: 'absolute',
    left: THUMB / 2,
    height: 6,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
});
