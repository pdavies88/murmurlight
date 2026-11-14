import Svg, { Circle, G, Path, Rect } from 'react-native-svg';

/** A simple line icon for each soundscape, drawn on a 32×32 grid in the given color. */
export function SoundIcon({ id, color, size = 32 }: { id: string; color: string; size?: number }) {
  const stroke = { stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  const cloud = 'M9 20a5 5 0 0 1 1-9.9A7 7 0 0 1 23.5 12 4.5 4.5 0 0 1 23 21H9.5z';

  const glyph = (() => {
    switch (id) {
      case 'rain':
        return (
          <G {...stroke}>
            <Path d={cloud} />
            <Path d="M11 24l-1 3M16 24l-1 3M21 24l-1 3" />
          </G>
        );
      case 'chimes':
        return (
          <G {...stroke}>
            <Path d="M5 5h22M9 5v4M14 5v4M19 5v4M24 5v4" />
            <Path d="M9 10v10M14 10v14M19 10v12M24 10v8" strokeWidth={3.2} />
            <Circle cx={16.5} cy={27.5} r={1.6} />
          </G>
        );
      case 'ocean':
        return (
          <G {...stroke}>
            <Path d="M4 13c3-3 6-3 9 0s6 3 9 0 4-2 6-1" />
            <Path d="M4 20c3-3 6-3 9 0s6 3 9 0 4-2 6-1" />
          </G>
        );
      case 'lullaby':
        return (
          <G {...stroke}>
            <Path d="M12 23V8l14-3v15" />
            <Circle cx={9} cy={23} r={3} />
            <Circle cx={23} cy={20} r={3} />
          </G>
        );
      case 'heartbeat':
        return (
          <G {...stroke}>
            <Path d="M16 27s-11-6.5-11-14a6 6 0 0 1 11-3.3A6 6 0 0 1 27 13c0 7.5-11 14-11 14z" />
            <Path d="M9 16h4l1.5-3 3 6 1.5-3h4" />
          </G>
        );
      case 'fire':
        return (
          <G {...stroke}>
            <Path d="M16 4c1 5 7 7 7 14a7 7 0 0 1-14 0c0-4 2-6 4-8 0 3 1 5 3 5 0-4-1-7 0-11z" />
          </G>
        );
      case 'guitar':
        return (
          <G {...stroke}>
            <Path d="M16 2.5v15.2M14 2.5h4M13.5 24.5h5" />
            <Path d="M16 11c-3.5 0-5.5 2.3-5 5.2-3 1.2-4.3 3.5-3.7 6.3.7 3.4 4.2 5.5 8.7 5.5s8-2.1 8.7-5.5c.6-2.8-.7-5.1-3.7-6.3.5-2.9-1.5-5.2-5-5.2z" />
            <Circle cx={16} cy={20} r={2.3} />
          </G>
        );
      case 'fan':
        return (
          <G {...stroke}>
            <Circle cx={16} cy={16} r={2} />
            <Path d="M16 14c-1-5 0-9 3-9s3 6-3 9zM18 16c5-1 9 0 9 3s-6 3-9-3zM16 18c1 5 0 9-3 9s-3-6 3-9zM14 16c-5 1-9 0-9-3s6-3 9 3z" />
          </G>
        );
      case 'brown-noise':
        return (
          <G {...stroke}>
            <Path d="M5 16v0M9 12v8M13 8v16M17 11v10M21 6v20M25 12v8M29 15v2" />
          </G>
        );
      case 'bells':
        return (
          <G {...stroke}>
            <Path d="M16 5c-5 0-8 4-8 9v5l-2 4h20l-2-4v-5c0-5-3-9-8-9z" />
            <Path d="M13 26a3 3 0 0 0 6 0" />
          </G>
        );
      case 'car':
        return (
          <G {...stroke}>
            <Path d="M3 22v-5.5l4-7.5h18l4 7.5V22" />
            <Path d="M7.5 16.5h17M3 22h3.5M12.5 22h7M25.5 22H29" />
            <Circle cx={9.5} cy={22.5} r={3} />
            <Circle cx={22.5} cy={22.5} r={3} />
          </G>
        );
      case 'shush':
        return (
          <G {...stroke}>
            <Path d="M12.5 25.6A11 11 0 1 1 19.5 25.6" />
            <Path d="M10.5 12q1.5 1.5 3 0M18.5 12q1.5 1.5 3 0M11 20h2M19 20h2" />
            <Rect x={14} y={15.5} width={4} height={14} rx={2} />
          </G>
        );
      case 'delta':
      case 'theta':
      case 'alpha': {
        // Headphones with a wave between the ears. Faster beats get more wave peaks.
        const peaks = id === 'delta' ? 1 : id === 'theta' ? 2 : 3;
        const step = 12 / peaks;
        let wave = 'M10 17';
        for (let i = 0; i < peaks; i++) wave += ` q${step / 4} -4 ${step / 2} 0 q${step / 4} 4 ${step / 2} 0`;
        return (
          <G {...stroke}>
            <Path d="M6 20v-3a10 10 0 0 1 20 0v3" />
            <Rect x={4} y={19} width={5} height={8} rx={2} />
            <Rect x={23} y={19} width={5} height={8} rx={2} />
            <Path d={wave} />
          </G>
        );
      }
      case 'om':
        return (
          <G {...stroke}>
            <Path d="M4 16h3l2-5 3 10 3-12 3 14 3-12 3 10 2-5h2" />
          </G>
        );
      case 'bowls':
        return (
          <G {...stroke}>
            <Path d="M5 15h22a11 9 0 0 1-22 0z" />
            <Path d="M9 27h14" />
            <Path d="M21 6l4-3" />
            <Path d="M13 10q3-2 6 0" />
          </G>
        );
      case 'white-noise':
        return (
          <G {...stroke}>
            <Path d="M5 9v14M9 7v18M13 9v14M17 7v18M21 9v14M25 7v18M29 9v14" />
          </G>
        );
      case 'green-noise':
        return (
          <G {...stroke}>
            <Path d="M5 15v2M9 12v8M13 8v16M17 6v20M21 8v16M25 12v8M29 15v2" />
          </G>
        );
      case 'birdsong':
        return (
          <G {...stroke}>
            <Path d="M4 14c4 10 16 13 20 2 2-5-1-9-4.5-8.5-3.5.5-4.5 3.5-5 6.5-3 2-7 2-10.5 0z" />
            <Path d="M24 11l4 1-4 1.5" />
            <Path d="M10 17.5c3 3 7 3 9 0" />
            <Circle cx={20.5} cy={11} r={0.9} />
          </G>
        );
      case 'leaves':
        return (
          <G {...stroke}>
            <Path d="M6 26C6 14 14 6 26 6c0 12-8 20-20 20z" />
            <Path d="M6 26L19 13M12 20h5M15 17v-5" />
          </G>
        );
      case 'chords':
        return (
          <G {...stroke}>
            <Path d="M17 26V3l6 3" />
            <Path d="M11 26a3 2 -20 1 0 6 0a3 2 -20 1 0 -6 0" />
            <Path d="M11 18.5a3 2 -20 1 0 6 0a3 2 -20 1 0 -6 0" />
            <Path d="M11 11a3 2 -20 1 0 6 0a3 2 -20 1 0 -6 0" />
          </G>
        );
      case 'flute':
        return (
          <G {...stroke}>
            <Path d="M6 6v20M11 6v17M16 6v14M21 6v11M26 6v8" strokeWidth={3.2} />
            <Path d="M4 10h24" />
          </G>
        );
      case 'piano':
        return (
          <G {...stroke}>
            <Rect x={4} y={7} width={24} height={18} rx={2} />
            <Path d="M10 18v7M16 18v7M22 18v7" />
            <Path d="M10 7v11M16 7v11M22 7v11" strokeWidth={4} />
          </G>
        );
      default:
        return <Circle cx={16} cy={16} r={10} {...stroke} />;
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no">
      {glyph}
    </Svg>
  );
}
