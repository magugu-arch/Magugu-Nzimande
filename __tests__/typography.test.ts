import fs from 'node:fs';
import path from 'node:path';
import {
  CHROME_FONT_SCALE_CAP,
  fontScaleCapFor,
  montserrat,
  playfair,
  supporting,
  typography,
  type TypographyVariant,
} from '@/theme/typography';

const MONTSERRAT = new Set<string>(Object.values(montserrat));
const PLAYFAIR = new Set<string>(Object.values(playfair));
const SUPPORTING = new Set<string>(Object.values(supporting));

/** §11: headlines, subheadings, buttons and labels are Montserrat. */
const PRIMARY_ROLES = [
  'hero',
  'display',
  'h1',
  'h2',
  'h3',
  'micro',
  'overline',
  'price',
  'buttonLg',
  'buttonMd',
  'buttonSm',
] as const;

/** §12: body copy, captions, lists and data are Arial. */
const SUPPORTING_ROLES = ['bodyLarge', 'body', 'bodyMedium', 'caption', 'captionMedium'] as const;

describe('typeface assignment', () => {
  it.each(PRIMARY_ROLES)('%s is set in Montserrat (§11)', (role) => {
    expect(MONTSERRAT.has(typography[role].fontFamily)).toBe(true);
  });

  it.each(SUPPORTING_ROLES)('%s is set in the supporting face (§12)', (role) => {
    expect(SUPPORTING.has(typography[role].fontFamily)).toBe(true);
  });

  it('reserves Playfair Display for accents and quotes (§13)', () => {
    const playfairRoles = Object.entries(typography)
      .filter(([, style]) => PLAYFAIR.has(style.fontFamily))
      .map(([role]) => role);

    // "Use it sparingly and with intention" — §13 is emphatic about this.
    expect(playfairRoles).toEqual(['quote']);
  });

  it('covers every role', () => {
    const assigned = new Set<string>([...PRIMARY_ROLES, ...SUPPORTING_ROLES, 'quote']);
    expect(Object.keys(typography).filter((r) => !assigned.has(r))).toEqual([]);
  });
});

describe('hierarchy rules', () => {
  // §14.3: body copy line height 140–160%.
  it.each(SUPPORTING_ROLES)('%s sits inside the 140–160% line-height band', (role) => {
    const { fontSize, lineHeight } = typography[role];
    const ratio = lineHeight / fontSize;
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(1.6);
  });

  // §14 sets H1–H3 in caps, but the app mockups set screen titles and product
  // names in sentence case. Caps stay with the campaign headline and the
  // section eyebrow; anything else would contradict the client's own screens.
  it('uppercases only the campaign headline and the section eyebrow', () => {
    const upper = Object.entries(typography)
      .filter(([, style]) => 'textTransform' in style && style.textTransform === 'uppercase')
      .map(([role]) => role);

    expect(upper.sort()).toEqual(['hero', 'overline']);
  });

  it('sizes the levels in descending order', () => {
    const ladder = ['hero', 'display', 'h1', 'h2', 'h3', 'body', 'caption'] as const;
    const sizes = ladder.map((role) => typography[role].fontSize);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  // §11.2 puts button text on Montserrat SemiBold; §22.4 gives the sizes.
  it.each([
    ['buttonLg', 16],
    ['buttonMd', 14],
    ['buttonSm', 13],
  ] as const)('%s is Montserrat SemiBold at %ipx', (role, size) => {
    expect(typography[role].fontFamily).toBe(montserrat.semibold);
    expect(typography[role].fontSize).toBe(size);
  });
});

/**
 * The quiet failure mode: a role names a weight the app never loads, so it
 * renders in the platform fallback and nobody notices until someone looks at
 * a device. Reading the root layout is the only way to catch it in a test.
 */
describe('every bundled face the type scale names is actually loaded', () => {
  const layout = fs.readFileSync(
    path.resolve(__dirname, '..', 'src', 'app', '_layout.tsx'),
    'utf8',
  );

  // Only the contents of the map handed to useFonts count. Matching anywhere
  // in the file would pass on the import alone, which is exactly the state a
  // dropped registration leaves behind.
  const registered = (() => {
    const block = /const brandFonts = \{([\s\S]*?)\n\};/.exec(layout);
    if (!block?.[1]) throw new Error('Could not find the brandFonts map in _layout.tsx');
    return new Set(
      block[1]
        .split('\n')
        .map((line) => line.trim().replace(/,$/, ''))
        .filter((line) => /^[A-Za-z]\w*$/.test(line)),
    );
  })();

  const bundled = [...MONTSERRAT, ...PLAYFAIR];

  it.each(bundled)('%s is registered with useFonts', (family) => {
    expect(registered.has(family)).toBe(true);
  });

  it('registers nothing the type scale does not use', () => {
    expect([...registered].filter((f) => !bundled.includes(f))).toEqual([]);
  });

  // The package root re-exports all eighteen Montserrat cuts and both Playfair
  // faces with static requires, so importing from it makes Metro ship every
  // one — about 4MB more than the eight in use. Tidying these back into a
  // single barrel import is an easy and completely invisible mistake.
  it('imports each weight from its own entry point, never the package root', () => {
    const roots = /from '@expo-google-fonts\/(montserrat|playfair-display)'/.exec(layout);
    expect(roots).toBeNull();

    for (const line of layout.split('\n')) {
      if (!line.includes('@expo-google-fonts')) continue;
      expect(line).toMatch(/@expo-google-fonts\/[a-z-]+\/[A-Za-z0-9_]+'/);
    }
  });

  // Same trap, different package: '@expo/vector-icons' re-exports nineteen
  // icon fonts with static requires, so importing Ionicons from the root ships
  // all of them — 4MB, on a 19MB bundle, for eighteen sets nothing renders.
  it('imports Ionicons from its own entry point, not the package root', () => {
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (/\.tsx?$/.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf8');
          if (source.includes("from '@expo/vector-icons'")) {
            offenders.push(path.relative(process.cwd(), full));
          }
        }
      }
    };
    walk(path.resolve(__dirname, '..', 'src'));

    expect(offenders).toEqual([]);
  });

  it('does not try to bundle the supporting face', () => {
    // §12 chose Arial because it ships with the platform. Bundling it would
    // add a megabyte for a face that is already there.
    for (const family of SUPPORTING) {
      expect(layout).not.toContain(`'${family}'`);
    }
  });
});

describe('how far each role follows the OS text size', () => {
  /**
   * React Native scales every `Text` by the device font scale unless told
   * otherwise, and nothing in this app told it otherwise. iOS reaches about
   * 3.1× at the largest accessibility size — enough to burst any fixed box.
   */
  it('caps the labels that live in fixed geometry', () => {
    for (const variant of ['buttonLg', 'buttonMd', 'buttonSm', 'overline', 'micro'] as const) {
      expect(fontScaleCapFor(variant)).toBe(CHROME_FONT_SCALE_CAP);
    }
  });

  it('lets the text people actually read scale without limit', () => {
    // Capping body copy would defeat the point of the setting.
    for (const variant of ['body', 'bodyMedium', 'caption', 'h1', 'h2', 'h3', 'price'] as const) {
      expect(fontScaleCapFor(variant)).toBeUndefined();
    }
  });

  it('caps at 200%, the figure WCAG 1.4.4 asks for', () => {
    expect(CHROME_FONT_SCALE_CAP).toBe(2);
  });

  it('gives every variant an answer', () => {
    // A variant added later must be a deliberate choice, not an omission — so
    // this walks the real scale rather than a hand-written list.
    for (const variant of Object.keys(typography) as TypographyVariant[]) {
      const cap = fontScaleCapFor(variant);
      expect(cap === undefined || cap >= 1).toBe(true);
    }
  });
});
