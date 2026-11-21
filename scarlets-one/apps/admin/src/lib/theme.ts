import { darkTheme, lightTheme, palette, radius, space, type, type Theme } from '@scarlets/ui';

const kebab = (name: string) => name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

function colourVars(theme: Theme): string {
  return Object.entries(theme)
    .filter(([key]) => key !== 'scheme')
    .map(([key, value]) => `--c-${kebab(key)}:${value};`)
    .join('');
}

/**
 * The @scarlets/ui tokens as CSS custom properties. The stylesheet names a
 * role (`var(--c-surface)`), never a hex, so the tokens stay the single
 * source of colour, spacing, radius and type for web as well as native.
 */
export function tokenCss(): string {
  const scale = [
    // The crest is shown as supplied, on the white ground it was drawn for, in both schemes.
    `--p-white:${palette.white};`,
    ...Object.entries(space).map(([key, value]) => `--s-${key}:${value}px;`),
    ...Object.entries(radius).map(([key, value]) => `--r-${key}:${value}px;`),
    ...Object.entries(type).flatMap(([key, style]) => [
      `--t-${key}-size:${style.size / 16}rem;`,
      `--t-${key}-leading:${style.leading / style.size};`,
      `--t-${key}-tracking:${style.tracking / style.size}em;`,
      `--t-${key}-weight:${style.weight};`,
    ]),
  ].join('');
  return [
    `:root{color-scheme:light dark;${scale}${colourVars(lightTheme)}}`,
    `@media (prefers-color-scheme:dark){:root{${colourVars(darkTheme)}}}`,
  ].join('');
}
