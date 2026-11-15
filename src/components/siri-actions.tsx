import * as AppIntents from 'expo-app-intents';
import { router } from 'expo-router';
import { useRef } from 'react';

import { usePlayback } from '@/context/playback-context';

/**
 * Carries out what Siri or the Shortcuts app asked for. The Swift intents in app-intents/ open the
 * app and queue the request, and this handles each one once. Renders nothing.
 */
export function SiriActions() {
  const { playNamedMix } = usePlayback();
  const handled = useRef(new Set<string>());

  AppIntents.useAppIntents(async (pending) => {
    for (const invocation of pending) {
      if (handled.current.has(invocation.id)) continue;
      handled.current.add(invocation.id);
      if (invocation.name === 'playMix' && typeof invocation.params.mixId === 'string') {
        playNamedMix(invocation.params.mixId);
        router.navigate('/sounds');
      } else if (invocation.name === 'startBreathing') {
        router.navigate({ pathname: '/breathe', params: { start: String(invocation.createdAt) } });
      } else if (invocation.name === 'windDown') {
        router.navigate({ pathname: '/wind-down', params: { start: String(invocation.createdAt) } });
      }
      await AppIntents.removePendingInvocationAsync(invocation.id).catch(() => undefined);
    }
  });

  return null;
}
