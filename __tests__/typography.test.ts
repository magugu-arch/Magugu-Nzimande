import fs from 'node:fs';
import path from 'node:path';
import type { TextStyle } from 'react-native';
import {
  CHROME_FONT_SCALE_CAP,
  allura,
  cinzel,
  fontScaleCapFor,
  montserrat,
  typography,
  type TypographyVariant,
} from '@/theme/typography';

const MONTSERRAT = new Set<string>(Object.values(montserrat));
const CINZEL = new Set<string>(Object.values(cinzel));
const ALLURA = new Set<string>(Object.values(allura));

/**
 * The Pappas type system — CI sheet panel 04, brief §3.
 *
 * Cinzel for display and editorial, Montserrat for everything a customer acts
 * on, Allura for one accent phrase. The brief is unusually specific about the
 * third — "never use for navigation, prices, form labels or critical
 * information" — and §13's accessibility floor gives the reason. So these
 * tests are mostly about keeping each face inside its lane.
 */

/** §3: "all interactive product UI, prices, descriptions, labels and buttons". */
const UI_ROLES = [
  'h3',
  'bodyLarge',
  'body',
  'bodyMedium',
  'caption',
  'captionMedium',
  'micro',
  'overline',
  'price',
  'buttonLg',
  'buttonMd',
  'buttonSm',
] as const;

/** §3: "hero headings, section titles and premium menu storytelling only". */
const DISPLAY_ROLES = ['hero', 'display', 'h1', 'h2', 'quote'] as const;

const BODY_ROLES = ['bodyLarge', 'body', 'bodyMedium', 'caption', 'captionMedium'] as const;

describe('typeface assignment', () => {
  it.each(UI_ROLES)('%s is set in Montserrat (§3)', (role) => {
    expect(MONTSERRAT.has(typography[role].fontFamily)).toBe(true);
  });

  it.each(DISPLAY_ROLES)('%s is set in Cinzel (§3)', (role) => {
    expect(CINZEL.has(typography[role].fontFamily)).toBe(true);
  });

  /**
   * §3 names a three-member system. A face that is none of the three must not
   * appear in the scale at all — including a platform face reached through
   * `Platform.select`, which is the shape this would most likely come back as.
   */
  it('admits no typeface outside the Pappas system (§3)', () => {
    const strays = Object.entries(typography)
      .filter(
        ([, style]) =>
          !MONTSERRAT.has(style.fontFamily) &&
          !CINZEL.has(style.fontFamily) &&
          !ALLURA.has(style.fontFamily),
      )
      .map(([role, style]) => `${role}: ${style.fontFamily}`);

    expect(strays).toEqual([]);
  });

  /**
   * The rule the brief is most emphatic about.
   *
   * "Use sparingly for a single emotional phrase or promotional accent; never
   * use for navigation, prices, form labels or critical information." One
   * role, and it is not one a customer needs in order to act.
   */
  it('reserves Allura for a single accent role (§3)', () => {
    const alluraRoles = Object.entries(typography)
      .filter(([, style]) => ALLURA.has(style.fontFamily))
      .map(([role]) => role);

    expect(alluraRoles).toEqual(['accent']);
  });

  it('never sets a price in anything but Montserrat (§3)', () => {
    // Called out separately because it is the single most tempting place to
    // reach for the display face, and the brief forbids it by name.
    expect(MONTSERRAT.has(typography.price.fontFamily)).toBe(true);
  });

  it('covers every role', () => {
    const assigned = new Set<string>([...UI_ROLES, ...DISPLAY_ROLES, 'accent']);
    expect(Object.keys(typography).filter((r) => !assigned.has(r))).toEqual([]);
  });
});

describe('hierarchy rules', () => {
  // §14.3's band, kept: body copy line height 140–160%.
  it.each(BODY_ROLES)('%s sits inside the 140–160% line-height band', (role) => {
    const { fontSize, lineHeight } = typography[role];
    const ratio = lineHeight / fontSize;
    expect(ratio).toBeGreaterThanOrEqual(1.4);
    expect(ratio).toBeLessThanOrEqual(1.6);
  });

  /**
   * Cinzel must never be given a `textTransform`.
   *
   * It is an inscriptional Roman face: its "lowercase" is a set of small
   * capitals. Forcing uppercase on top of that replaces the small caps with
   * full caps unevenly and destroys the rhythm the supplied posters have.
   */
  it('never uppercases a Cinzel role', () => {
    const offenders = Object.entries(typography)
      .filter(
        ([, style]) =>
          CINZEL.has(style.fontFamily) &&
          'textTransform' in style &&
          style.textTransform === 'uppercase',
      )
      .map(([role]) => role);

    expect(offenders).toEqual([]);
  });

  it('uppercases only the section eyebrow', () => {
    const upper = Object.entries(typography)
      .filter(([, style]) => 'textTransform' in style && style.textTransform === 'uppercase')
      .map(([role]) => role);

    expect(upper).toEqual(['overline']);
  });

  /**
   * Capitals need air; Montserrat's lowercase does not.
   *
   * Every Cinzel role is set in capitals whatever is typed into it, so each
   * needs positive tracking — the supplied artwork sets them generously open.
   * A negative value here would be the old brand's setting left behind.
   */
  it('tracks the capital faces open, not tight', () => {
    for (const [role, style] of Object.entries(typography) as [string, TextStyle][]) {
      if (!CINZEL.has(style.fontFamily ?? '')) continue;
      expect([role, style.letterSpacing ?? 0]).toEqual([role, expect.any(Number)]);
      expect(style.letterSpacing ?? 0).toBeGreaterThan(0);
    }
  });

  it('sizes the levels in descending order', () => {
    const ladder = ['hero', 'display', 'h1', 'h2', 'h3', 'body', 'caption'] as const;
    const sizes = ladder.map((role) => typography[role].fontSize);
    expect([...sizes].sort((a, b) => b - a)).toEqual(sizes);
  });

  it.each([
    ['buttonLg', 15],
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

  const bundled = [...MONTSERRAT, ...CINZEL, ...ALLURA];

  it.each(bundled)('%s is registered with useFonts', (family) => {
    expect(registered.has(family)).toBe(true);
  });

  it('registers nothing the type scale does not use', () => {
    expect([...registered].filter((f) => !bundled.includes(f))).toEqual([]);
  });

  // The package roots re-export every cut with static requires, so importing
  // from one makes Metro ship all of them — megabytes for faces nothing
  // renders. Tidying these back into a single barrel import is an easy and
  // completely invisible mistake.
  it('imports each weight from its own entry point, never the package root', () => {
    const roots = /from '@expo-google-fonts\/(montserrat|cinzel|allura)'/.exec(layout);
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

  /**
   * The scale must not reach for a platform face.
   *
   * `admits no typeface outside the Pappas system` above catches a stray
   * family name, but only for the platform the test happens to run on: a
   * `Platform.select` resolves to one branch, so a Georgia hiding in the iOS
   * arm would sail past a Jest run reporting as Android. This reads the source
   * instead, which sees every branch.
   */
  it('names no platform face in the type scale (§3)', () => {
    const scale = fs.readFileSync(
      path.resolve(__dirname, '..', 'src', 'theme', 'typography.ts'),
      'utf8',
    );
    const code = scale.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

    expect(code).not.toMatch(/Platform\s*\.\s*select/);
    for (const face of ['Arial', 'Helvetica', 'Georgia', 'Roboto', 'sans-serif', 'System']) {
      expect(code).not.toContain(face);
    }
  });
});

describe('how far each role follows the OS text size', () => {
  it('caps the labels that live in fixed geometry', () => {
    for (const variant of ['buttonLg', 'buttonMd', 'buttonSm', 'overline', 'micro'] as const) {
      expect(fontScaleCapFor(variant)).toBe(CHROME_FONT_SCALE_CAP);
    }
  });

  /**
   * Allura is capped too — the one addition Pappas makes to the list.
   *
   * At 3× it is 72px of looping script that does not wrap gracefully, it is
   * decorative rather than informative by §3's own instruction, and letting it
   * grow unbounded pushes the content someone turned the setting up to read
   * off the bottom of the screen.
   */
  it('caps the decorative accent, which nobody enlarged the text to read', () => {
    expect(fontScaleCapFor('accent')).toBe(CHROME_FONT_SCALE_CAP);
  });

  it('lets the text people actually read scale without limit', () => {
    for (const variant of ['body', 'bodyMedium', 'caption', 'h1', 'h2', 'h3', 'price'] as const) {
      expect(fontScaleCapFor(variant)).toBeUndefined();
    }
  });

  it('caps at 200%, the figure WCAG 1.4.4 asks for', () => {
    expect(CHROME_FONT_SCALE_CAP).toBe(2);
  });

  it('gives every variant an answer', () => {
    for (const variant of Object.keys(typography) as TypographyVariant[]) {
      const cap = fontScaleCapFor(variant);
      expect(cap === undefined || cap >= 1).toBe(true);
    }
  });
});

/**
 * The floors that keep this scale readable on a handset.
 *
 * Every one of these is a defect that shipped. The app was designed against a
 * desktop browser preview, where 11px Montserrat Regular on warm stone looks
 * refined; on a phone at arm's length it is a grey smudge, and that is what a
 * customer reported — "make the text bold, it's not readable".
 *
 * These are deliberately floors rather than exact values. The scale should be
 * free to move; what it must not do is drift back under the thresholds where
 * legibility goes, one convenient tweak at a time.
 */
describe('the legibility floors', () => {
  /** Roles a customer reads as prose, rather than glances at as a label. */
  const READING_ROLES = ['bodyLarge', 'body', 'bodyMedium', 'caption', 'captionMedium'] as const;

  it('sets no role below 12px', () => {
    for (const [name, style] of Object.entries(typography)) {
      expect({ role: name, size: style.fontSize }).toEqual({
        role: name,
        size: expect.any(Number),
      });
      expect(style.fontSize).toBeGreaterThanOrEqual(12);
    }
  });

  /**
   * Montserrat is geometric — circular counters, near-uniform stroke — so it
   * lays down less ink at a given weight than the humanist faces most UI
   * scales are tuned on. On this app's warm ground that shows. Regular is a
   * step too light for anything a customer has to read.
   */
  it('sets every reading role at Medium or heavier', () => {
    for (const role of READING_ROLES) {
      expect({ role, weight: Number(typography[role].fontWeight) }).toEqual({
        role,
        weight: expect.any(Number),
      });
      expect(Number(typography[role].fontWeight)).toBeGreaterThanOrEqual(500);
    }
  });

  it('gives every reading role room to breathe between lines', () => {
    for (const role of READING_ROLES) {
      const { fontSize, lineHeight } = typography[role];
      expect({ role, ratio: Number((lineHeight / fontSize).toFixed(2)) >= 1.3 }).toEqual({
        role,
        ratio: true,
      });
    }
  });

  /**
   * Tracking that opens a display line destroys word shape at text sizes: a
   * reader stops seeing a word and starts assembling it letter by letter.
   * 10% of the em still reads unmistakably as a spaced capital eyebrow.
   */
  it('keeps the eyebrow tracking under a tenth of its own size', () => {
    const { fontSize, letterSpacing } = typography.overline;
    expect(letterSpacing).toBeLessThanOrEqual(fontSize * 0.105);
  });
});
