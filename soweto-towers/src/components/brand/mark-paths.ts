/**
 * The Soweto Towers mark: two cooling towers, the bridge between them and a
 * jumper on the cord. One geometry (64 × 64 viewBox) feeds the header logo,
 * the favicon, the app icons and the share images.
 */
export const MARK_VIEWBOX = '0 0 64 64';

export const markPaths = {
  // Hyperboloid silhouettes: a flared lip, a pinched waist, a wide base.
  towerWest: 'M12.6 11 H25.4 C24.2 18 23.4 26 23.9 32 C24.6 41 27.2 48.5 30.6 54 H7.4 C10.8 48.5 13.4 41 14.1 32 C14.6 26 13.8 18 12.6 11 Z',
  towerEast: 'M38.2 16 H49.4 C48.4 22.5 47.7 29.5 48.2 35 C48.8 42.5 51 49 53.8 54 H33.8 C36.6 49 38.8 42.5 39.4 35 C39.9 29.5 39.2 22.5 38.2 16 Z',
  bridge: 'M25 12.2 L38.6 17.1',
  cord: 'M31.6 14.6 C32.1 20 31.1 24.6 31.7 29',
  jumper: { cx: 31.7, cy: 31.5, r: 2.3 },
} as const;

export const brandColors = {
  orangeTop: '#EE7A45',
  orangeBottom: '#D94A1E',
  ink: '#1E2020',
  paper: '#F4F3EF',
  charcoalTop: '#434345',
  charcoalBottom: '#232325',
} as const;

/** Self-contained SVG markup for build scripts (icons, share images). */
export function markSvg({
  size,
  background,
  inset = 0,
  detail = '#F4F3EF',
  radius = 0,
}: {
  size: number;
  background: 'charcoal' | 'none';
  /** Fraction of the canvas to leave clear around the mark (maskable icons need ~0.2). */
  inset?: number;
  detail?: string;
  radius?: number;
}): string {
  const p = markPaths;
  const scale = 1 - inset * 2;
  const offset = 32 - 32 * scale;
  const bg = background === 'charcoal' ? `<rect width="64" height="64" rx="${radius}" fill="url(#bg)"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${MARK_VIEWBOX}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${brandColors.charcoalTop}"/>
      <stop offset="1" stop-color="${brandColors.charcoalBottom}"/>
    </linearGradient>
    <linearGradient id="tw" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${brandColors.orangeTop}"/>
      <stop offset="1" stop-color="${brandColors.orangeBottom}"/>
    </linearGradient>
  </defs>
  ${bg}
  <g transform="translate(${offset} ${offset}) scale(${scale})">
    <path d="${p.towerWest}" fill="url(#tw)"/>
    <path d="${p.towerEast}" fill="url(#tw)"/>
    <path d="${p.bridge}" stroke="${detail}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
    <path d="${p.cord}" stroke="${detail}" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    <circle cx="${p.jumper.cx}" cy="${p.jumper.cy}" r="${p.jumper.r}" fill="${detail}"/>
  </g>
</svg>`;
}
