import { HStack, Image, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  font,
  foregroundStyle,
  monospacedDigit,
  multilineTextAlignment,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export type SleepTimerActivityProps = {
  /** The sounds in the mix, for example "Rain + Crackling Fire". */
  mix: string;
  /** When the timer started and when the mix stops, in milliseconds since 1970. */
  startedAt: number;
  endsAt: number;
};

/**
 * The sleep timer on the Lock Screen and in the Dynamic Island. The countdown runs on the system
 * clock, so it stays right while the app is in the background.
 *
 * This function runs in the widget's own runtime: it can't use anything declared outside it.
 */
const SleepTimerActivity = (props: SleepTimerActivityProps, environment: LiveActivityEnvironment) => {
  'widget';
  const accent = environment.isLuminanceReduced ? '#FFFFFF' : '#A99CFF';
  const interval = { lower: new Date(props.startedAt), upper: new Date(props.endsAt) };

  return {
    banner: (
      <HStack modifiers={[padding({ all: 16 })]}>
        <Image systemName="moon.zzz.fill" color={accent} />
        <VStack alignment="leading">
          <Text modifiers={[font({ weight: 'bold', size: 15 })]}>Lullmix</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle('secondary')]}>{props.mix}</Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing">
          <Text
            timerInterval={interval}
            countsDown
            modifiers={[
              font({ weight: 'bold', size: 22 }),
              monospacedDigit(),
              multilineTextAlignment('trailing'),
              foregroundStyle(accent),
            ]}
          />
          <Text modifiers={[font({ size: 12 }), foregroundStyle('secondary')]}>then fades out</Text>
        </VStack>
      </HStack>
    ),
    compactLeading: <Image systemName="moon.zzz.fill" color={accent} />,
    compactTrailing: (
      <Text
        timerInterval={interval}
        countsDown
        modifiers={[monospacedDigit(), multilineTextAlignment('trailing'), foregroundStyle(accent)]}
      />
    ),
    minimal: <Image systemName="moon.zzz.fill" color={accent} />,
    expandedLeading: (
      <VStack alignment="leading" modifiers={[padding({ all: 8 })]}>
        <Image systemName="moon.zzz.fill" color={accent} />
        <Text modifiers={[font({ size: 12 })]}>Sleep timer</Text>
      </VStack>
    ),
    expandedTrailing: (
      <Text
        timerInterval={interval}
        countsDown
        modifiers={[
          font({ weight: 'bold', size: 22 }),
          monospacedDigit(),
          multilineTextAlignment('trailing'),
          padding({ all: 8 }),
          foregroundStyle(accent),
        ]}
      />
    ),
    expandedBottom: (
      <Text modifiers={[font({ size: 13 }), foregroundStyle('secondary'), padding({ horizontal: 8 })]}>
        {props.mix}
      </Text>
    ),
  };
};

export default createLiveActivity('SleepTimerActivity', SleepTimerActivity);
