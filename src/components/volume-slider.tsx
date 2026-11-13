import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { clampVolume } from '@/lib/mix';

type VolumeSliderProps = {
  /** 0 to 1. */
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  trackColor: string;
  fillColor: string;
};

const THUMB = 20;
/** How far one VoiceOver or TalkBack swipe moves the volume. */
const STEP = 0.1;

/** A drag-anywhere volume bar. Touching it jumps the volume to that point. */
export function VolumeSlider({ value, onChange, accessibilityLabel, trackColor, fillColor }: VolumeSliderProps) {
  const [width, setWidth] = useState(0);
  const travel = Math.max(width - THUMB, 0);

  // The children ignore touches, so `locationX` is always measured from this view's left edge.
  const setFromTouch = (event: GestureResponderEvent) => {
    if (travel > 0) onChange(clampVolume((event.nativeEvent.locationX - THUMB / 2) / travel));
  };

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) =>
        onChange(clampVolume(value + (event.nativeEvent.actionName === 'increment' ? STEP : -STEP)))
      }
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={setFromTouch}
      onResponderMove={setFromTouch}
      style={styles.touchArea}>
      <View pointerEvents="none" style={[styles.track, { backgroundColor: trackColor }]}>
        <View style={[styles.fill, { width: value * travel + THUMB / 2, backgroundColor: fillColor }]} />
      </View>
      <View pointerEvents="none" style={[styles.thumb, { left: value * travel, backgroundColor: fillColor }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  touchArea: {
    height: 44,
    justifyContent: 'center',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
  },
});
