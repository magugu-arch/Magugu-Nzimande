import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

export type BrandIconName =
  | 'reservations'
  | 'menu'
  | 'wine'
  | 'events'
  | 'vouchers'
  | 'location'
  | 'gallery'
  | 'contact'
  | 'rewards'
  | 'profile'
  | 'home'
  | 'discover';

/**
 * The BRAND ICONS panel on the board: thin, single-weight brass line icons.
 * Redrawn as SVG so they stay crisp and take the theme colour.
 */
export function BrandIcon({
  name,
  size = 28,
  color = colors.accent,
  strokeWidth = 1.4,
}: {
  name: BrandIconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const p = {
    stroke: color,
    strokeWidth,
    fill: 'none',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {name === 'reservations' && (
        <>
          <Rect x={5} y={7} width={22} height={20} rx={1.5} {...p} />
          <Line x1={5} y1={13} x2={27} y2={13} {...p} />
          <Line x1={11} y1={4} x2={11} y2={9} {...p} />
          <Line x1={21} y1={4} x2={21} y2={9} {...p} />
          <Path d="M18 20.5 L20 22.5 L23.5 18.5" {...p} />
        </>
      )}
      {name === 'menu' && (
        <>
          <Path d="M10 4 V13 M7 4 V11 A3 3 0 0 0 13 11 V4 M10 13 V28" {...p} />
          <Path d="M22 28 V4 C25 6 26 10 26 15 H22" {...p} />
        </>
      )}
      {name === 'wine' && (
        <>
          <Path d="M10 4 H22 C22 11 21 16 16 17 C11 16 10 11 10 4 Z" {...p} />
          <Line x1={16} y1={17} x2={16} y2={27} {...p} />
          <Line x1={11} y1={27.5} x2={21} y2={27.5} {...p} />
          <Line x1={10.6} y1={9} x2={21.4} y2={9} {...p} />
        </>
      )}
      {name === 'events' && (
        <>
          <Circle cx={16} cy={10} r={3.5} {...p} />
          <Circle cx={7.5} cy={13} r={2.8} {...p} />
          <Circle cx={24.5} cy={13} r={2.8} {...p} />
          <Path d="M10 26 C10 19 13 16.5 16 16.5 C19 16.5 22 19 22 26" {...p} />
          <Path d="M3 25 C3 20 5 18 7.5 18 C8.6 18 9.5 18.3 10.2 18.9" {...p} />
          <Path d="M29 25 C29 20 27 18 24.5 18 C23.4 18 22.5 18.3 21.8 18.9" {...p} />
        </>
      )}
      {name === 'vouchers' && (
        <>
          <Rect x={5} y={12} width={22} height={15} rx={1} {...p} />
          <Rect x={4} y={8.5} width={24} height={4} rx={1} {...p} />
          <Line x1={16} y1={8.5} x2={16} y2={27} {...p} />
          <Path
            d="M16 8.5 C13 8.5 10.5 7.5 10.5 5.5 C10.5 3.5 13.5 3.5 16 8.5 C18.5 3.5 21.5 3.5 21.5 5.5 C21.5 7.5 19 8.5 16 8.5"
            {...p}
          />
        </>
      )}
      {name === 'location' && (
        <>
          <Path d="M16 28 C16 28 7 19 7 12.5 A9 9 0 0 1 25 12.5 C25 19 16 28 16 28 Z" {...p} />
          <Circle cx={16} cy={12.5} r={3.2} {...p} />
        </>
      )}
      {name === 'gallery' && (
        <>
          <Rect x={4} y={6} width={24} height={20} rx={1.5} {...p} />
          <Circle cx={11} cy={12} r={2.2} {...p} />
          <Path d="M4 23 L12 16 L18 21 L22 17.5 L28 22" {...p} />
        </>
      )}
      {name === 'contact' && (
        <Path
          d="M8 4.5 L12 4.5 L14 10 L11.5 12 C13 15.5 16.5 19 20 20.5 L22 18 L27.5 20 L27.5 24 C27.5 26 26 27.5 24 27.5 C14 27 5 18 4.5 8 C4.5 6 6 4.5 8 4.5 Z"
          {...p}
        />
      )}
      {name === 'rewards' && (
        <>
          <Path
            d="M16 4 L19.2 11.2 L27 12 L21 17.2 L22.8 25 L16 21 L9.2 25 L11 17.2 L5 12 L12.8 11.2 Z"
            {...p}
          />
        </>
      )}
      {name === 'profile' && (
        <>
          <Circle cx={16} cy={11} r={5} {...p} />
          <Path d="M6 27 C6 20.5 10.5 17.5 16 17.5 C21.5 17.5 26 20.5 26 27" {...p} />
        </>
      )}
      {name === 'home' && (
        <>
          <Path d="M5 14 L16 5 L27 14" {...p} />
          <Path d="M8 12 V27 H24 V12" {...p} />
          <Path d="M13.5 27 V19.5 H18.5 V27" {...p} />
        </>
      )}
      {name === 'discover' && (
        <>
          <Circle cx={16} cy={16} r={11.5} {...p} />
          <Path d="M20.5 11.5 L18 18 L11.5 20.5 L14 14 Z" {...p} />
        </>
      )}
    </Svg>
  );
}
