import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { containerBackground, font, foregroundStyle, lineLimit, padding, widgetURL } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';

export type WidgetMix = {
  /** A saved mix id, or "current" for the mix on the Sounds tab. */
  id: string;
  name: string;
  /** The sounds in the mix, for example "Gentle Rain + Crackling Fire". */
  detail: string;
};

export type MixesWidgetProps = {
  mixes: WidgetMix[];
};

/**
 * The home screen widget: tap a mix to start it. The small size plays the first mix, the medium
 * size lists up to three. Each tap opens the app through a relaxationstation://play link.
 *
 * This function runs in the widget's own runtime: it can't use anything declared outside it.
 */
const MixesWidget = (props: MixesWidgetProps, environment: WidgetEnvironment) => {
  'widget';
  const dark = environment.colorScheme === 'dark';
  const background = dark ? '#15152A' : '#F1EFF8';
  const accent = dark ? '#A99CFF' : '#4B3FB5';
  const text = dark ? '#F3F1FF' : '#16142B';
  const secondary = dark ? '#A9A6C4' : '#5F5B76';
  const link = (id: string) => `relaxationstation://play?mix=${encodeURIComponent(id)}`;
  const first = props.mixes[0];

  if (!first) {
    return (
      <VStack
        alignment="leading"
        modifiers={[padding({ all: 4 }), containerBackground(background, 'widget'), widgetURL('relaxationstation://')]}>
        <Image systemName="moon.zzz.fill" color={accent} />
        <Spacer />
        <Text modifiers={[font({ weight: 'bold', size: 15 }), foregroundStyle(text)]}>Murmurlight</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(secondary)]}>Build a mix to start it from here.</Text>
      </VStack>
    );
  }

  if (environment.widgetFamily !== 'systemMedium') {
    return (
      <VStack
        alignment="leading"
        modifiers={[padding({ all: 4 }), containerBackground(background, 'widget'), widgetURL(link(first.id))]}>
        <HStack>
          <Image systemName="moon.zzz.fill" color={accent} />
          <Spacer />
          <Image systemName="play.circle.fill" color={accent} />
        </HStack>
        <Spacer />
        <Text modifiers={[font({ weight: 'bold', size: 16 }), foregroundStyle(text), lineLimit(2)]}>{first.name}</Text>
        <Text modifiers={[font({ size: 12 }), foregroundStyle(secondary), lineLimit(2)]}>{first.detail}</Text>
      </VStack>
    );
  }

  return (
    <VStack alignment="leading" spacing={6} modifiers={[padding({ all: 4 }), containerBackground(background, 'widget')]}>
      <HStack>
        <Image systemName="moon.zzz.fill" color={accent} />
        <Text modifiers={[font({ weight: 'bold', size: 13 }), foregroundStyle(accent)]}>Murmurlight</Text>
        <Spacer />
      </HStack>
      {props.mixes.slice(0, 3).map((mix) => (
        <Link key={mix.id} destination={link(mix.id)}>
          <HStack>
            <Image systemName="play.circle.fill" color={accent} />
            <VStack alignment="leading">
              <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle(text), lineLimit(1)]}>
                {mix.name}
              </Text>
              <Text modifiers={[font({ size: 11 }), foregroundStyle(secondary), lineLimit(1)]}>{mix.detail}</Text>
            </VStack>
            <Spacer />
          </HStack>
        </Link>
      ))}
      <Spacer />
    </VStack>
  );
};

export default createWidget<MixesWidgetProps>('MixesWidget', MixesWidget, { mixes: [] });
