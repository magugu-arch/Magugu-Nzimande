/**
 * The Soweto Towers logo: identity option 01, the S + T monogram. Drawn from
 * the identity document's own artwork (st-identity.ts), so every size matches
 * it exactly. The S and its bridge take the ink colour; the T's stem, the
 * drop, is always crimson.
 *
 * Tones: 'ink' on light backgrounds (tower black), 'paper' on dark (bone).
 */
import { stColors, stDescriptor, stLockup, stMark, stWordmark, stWordmarkTwoLine } from './st-identity';
import styles from './Logo.module.css';

type Tone = 'ink' | 'paper';
const inkFor = (tone: Tone) => (tone === 'paper' ? stColors.bone : stColors.towerBlack);

/** Accessible name: a label by default, or `null` when a surrounding link already names it. */
function label(title: string | null | undefined, fallback: string) {
  const name = title === undefined ? fallback : title;
  return name ? { role: 'img' as const, 'aria-label': name } : { 'aria-hidden': true as const };
}

/** The monogram alone: favicon-style uses, stamps, the crew console. `size` is its height in px. */
export function Mark({ tone = 'ink', size = 34, title }: { tone?: Tone; size?: number; title?: string }) {
  const width = Math.round((size * stMark.width) / stMark.height);
  return (
    <svg width={width} height={size} viewBox={`0 0 ${stMark.width} ${stMark.height}`} className={styles.mark} {...label(title, '')}>
      <path fill={inkFor(tone)} d={stMark.s} />
      <path fill={stColors.crimson} d={stMark.t} />
    </svg>
  );
}

/** Horizontal lockup: the monogram beside SOWETO / TOWERS. `size` is the monogram's height in px. */
export function Logo({ tone = 'ink', size = 38, title }: { tone?: Tone; size?: number; title?: string | null }) {
  const ink = inkFor(tone);
  const textX = stMark.width + stLockup.gap;
  const vw = textX + stWordmarkTwoLine.width;
  const vh = stMark.height;
  const width = Math.round((size * vw) / vh);
  return (
    <svg width={width} height={size} viewBox={`0 0 ${vw.toFixed(2)} ${vh}`} className={styles.logo} {...label(title, 'Soweto Towers')}>
      <path fill={ink} d={stMark.s} />
      <path fill={stColors.crimson} d={stMark.t} />
      <path fill={ink} d={stWordmarkTwoLine.d} transform={`translate(${textX.toFixed(2)} ${stLockup.dy})`} />
    </svg>
  );
}

/**
 * Stacked lockup: the monogram over SOWETO TOWERS, with VERTICAL ADVENTURE
 * CENTRE below when `descriptor` is set. `width` is the lockup's width in px.
 */
export function LogoStacked({
  tone = 'ink',
  width = 220,
  descriptor = false,
  title,
}: {
  tone?: Tone;
  width?: number;
  descriptor?: boolean;
  title?: string | null;
}) {
  const ink = inkFor(tone);
  const scale = stLockup.stackedMarkWidth / stMark.width;
  const markH = stMark.height * scale;
  const wordY = markH + stLockup.stackedGap;
  const descY = wordY + stWordmark.height + stLockup.descriptorGap;
  const vw = stWordmark.width;
  const vh = descriptor ? descY + stDescriptor.height : wordY + stWordmark.height;
  const height = Math.round((width * vh) / vw);
  const markX = (vw - stLockup.stackedMarkWidth) / 2;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${vw} ${vh.toFixed(2)}`}
      className={styles.logo}
      {...label(title, descriptor ? 'Soweto Towers, Vertical Adventure Centre' : 'Soweto Towers')}
    >
      <g transform={`translate(${markX.toFixed(2)} 0) scale(${scale.toFixed(4)})`}>
        <path fill={ink} d={stMark.s} />
        <path fill={stColors.crimson} d={stMark.t} />
      </g>
      <path fill={ink} d={stWordmark.d} transform={`translate(0 ${wordY.toFixed(2)})`} />
      {descriptor && <path fill={ink} d={stDescriptor.d} transform={`translate(0 ${descY.toFixed(2)})`} />}
    </svg>
  );
}
