import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useEffectEvent } from 'react';

import { usePlayback } from '@/context/playback-context';

/**
 * The home screen widget's links land here (relaxationstation://play?mix=<id>). This starts the
 * mix, then shows the Sounds tab.
 */
export default function PlayLink() {
  const { mix } = useLocalSearchParams<{ mix?: string }>();
  const { playNamedMix } = usePlayback();
  const play = useEffectEvent(() => playNamedMix(mix ?? 'current'));
  useEffect(() => {
    play();
  }, [mix]);
  return <Redirect href="/sounds" />;
}
