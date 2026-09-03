import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { AA, contrastRatio, luminance, meetsAA, parseHex, ratioOf } from '@/lib/a11y/contrast';
import tokens from '../../../packages/ui/src/tokens.json';

/**
 * Accessibility, checked rather than asserted.
 *
 * The brand palette is fixed by the guidelines and is not ours to change, so
 * what a test can usefully do is say which of its pairings may carry text. A
 * combination that fails here is not a bug to fix by darkening the red — it is
 * a combination the interface must not use, and the test names it so the choice
 * is made once rather than re-eyeballed per screen.
 *
 * The static scans below are deliberately modest. They cannot replace a person
 * with a screen reader, and §11 of the readiness document still lists that as
 * outstanding. They catch the failures that are textual and therefore cheap:
 * an image with no alt, a control with no name, headings that skip a level.
 */

const TEMPLATE = readFileSync(
  path.resolve(__dirname, '../static-demo/index.template.html'),
  'utf8',
);

const COMPONENTS = path.resolve(__dirname, '../src/components');
/**
 * The pages too.
 *
 * The scans below read `src/components` and stopped there, which left every
 * route's own markup unchecked — an image in a page body, a heading level in a
 * hero, a click handler on a div. Pages are where most of the markup on this
 * site actually is.
 */
const PAGES = path.resolve(__dirname, '../src/app');

describe('the contrast maths', () => {
  /** Anchored against the two ratios everybody knows, or the rest proves nothing. */
  it('agrees with the values WCAG publishes', () => {
    expect(ratioOf('#000000', '#FFFFFF')).toBe(21);
    expect(ratioOf('#FFFFFF', '#FFFFFF')).toBe(1);
  });

  it('does not care which way round the pair is given', () => {
    expect(contrastRatio(tokens.brand.red, tokens.brand.white)).toBeCloseTo(
      contrastRatio(tokens.brand.white, tokens.brand.red),
      10,
    );
  });

  /**
   * The sRGB inverse companding, not a gamma of 2.2 and not a channel average.
   * A home-made approximation passes its own checker and fails a real audit, so
   * the curve is pinned at the point where the two differ most.
   */
  it('uses the sRGB transfer rather than a plain average', () => {
    // Mid grey. A naive (r+g+b)/3/255 would give 0.5; the real answer is far
    // darker, because perceived brightness is not linear in the code value.
    expect(luminance(parseHex('#808080'))).toBeCloseTo(0.2158, 3);
  });

  it('reads short hex and long hex the same way', () => {
    expect(parseHex('#FFF')).toEqual(parseHex('#FFFFFF'));
  });

  it('refuses something that is not a colour', () => {
    expect(() => parseHex('#GGGGGG')).toThrow();
  });

  /**
   * The thresholds themselves, pinned to the numbers WCAG 2.2 publishes.
   *
   * Found by mutation: dropping AA.text from 4.5 to 3 broke none of the pairing
   * tests below, because every pair either clears the bar comfortably or fails
   * it comfortably. A weakened threshold would have silently passed a palette
   * nobody could read, and the pairing tests would have gone on looking green.
   */
  it('holds the AA thresholds at the published values', () => {
    expect(AA.text, 'normal text').toBe(4.5);
    expect(AA.largeText, '18.66px bold or 24px regular').toBe(3);
    expect(AA.interface, 'borders, focus rings, meaningful icons').toBe(3);
  });

  /** And that the comparison is against the threshold rather than beside it. */
  it('accepts a pair exactly on the line and refuses one just under', () => {
    // #767676 on white is the canonical 4.54:1 — the greyest grey that passes.
    expect(meetsAA('#767676', '#FFFFFF')).toBe(true);
    expect(meetsAA('#777777', '#FFFFFF')).toBe(false);
  });
});

describe('the pairings the interface actually uses', () => {
  const { red, black, white, yellow, gold } = tokens.brand;
  const paper = tokens.neutralTints[10];
  const muted = tokens.neutralTints[100];

  /**
   * Body text, on each of the three grounds it is ever set on. These are the
   * pairs that carry the menu, the prices and the checkout, so they are held to
   * the full 4.5 rather than the large-text allowance.
   */
  it('sets body text at AA on every ground it uses', () => {
    for (const [name, pair] of [
      ['black on white', [black, white]],
      ['black on paper', [black, paper]],
      ['white on black', [white, black]],
      ['white on red', [white, red]],
      ['black on yellow', [black, yellow]],
    ] as const) {
      expect([name, meetsAA(pair[0], pair[1])], `${name} is ${ratioOf(pair[0], pair[1])}:1`).toEqual(
        [name, true],
      );
    }
  });

  /** The secondary grey, which is the one most likely to have been chosen by eye. */
  it('keeps the muted grey readable on both light grounds', () => {
    expect(meetsAA(muted, white), `on white: ${ratioOf(muted, white)}:1`).toBe(true);
    expect(meetsAA(muted, paper), `on paper: ${ratioOf(muted, paper)}:1`).toBe(true);
  });

  /**
   * The approved red clears AA on white, at 4.71:1 — but only just, and this
   * test exists to notice if that ever stops being true.
   *
   * The guidelines fix the red; a future tint adjustment that took it to 4.4
   * would be invisible to review and would put every red heading and price
   * below the line at once. Written as the ratio rather than a boolean so the
   * failure message says how far it moved.
   */
  it('carries text in the approved red on white, with very little to spare', () => {
    expect(meetsAA(red, white), `red on white is ${ratioOf(red, white)}:1`).toBe(true);
    expect(ratioOf(red, white), 'the margin is thin enough to be worth watching').toBeLessThan(5);
  });

  /**
   * Gold is 2.07:1 on white — nowhere near, and not a candidate for text at any
   * size. It is a ground and a rule, and saying so here is cheaper than
   * discovering it in an audit.
   */
  it('will not carry text in gold on white at any size', () => {
    expect(meetsAA(gold, white), `gold on white is ${ratioOf(gold, white)}:1`).toBe(false);
    expect(meetsAA(gold, white, 'largeText')).toBe(false);
    expect(meetsAA(gold, white, 'interface')).toBe(false);
  });

  /** A focus ring nobody can see is a focus ring nobody has. */
  it('keeps every interface accent visible against its ground', () => {
    expect(meetsAA(red, white, 'interface')).toBe(true);
    expect(meetsAA(red, paper, 'interface')).toBe(true);
    expect(meetsAA(white, black, 'interface')).toBe(true);
  });

  /**
   * The tint ladders exist so a designer can reach for a lighter red without
   * inventing one. The light end is for grounds, not for text, and this says
   * which is which rather than leaving it to be discovered.
   */
  it('marks which end of each ladder may carry text', () => {
    expect(meetsAA(tokens.redTints[100], white, 'largeText'), 'the full-strength end').toBe(true);
    expect(meetsAA(tokens.redTints[20], white), 'the pale end, on white').toBe(false);
    expect(meetsAA(black, tokens.redTints[10]), 'and black on the palest tint').toBe(true);
  });
});

describe('the review build', () => {
  it('gives every image an alt attribute', () => {
    const images = TEMPLATE.match(/<img\b[^>]*>/g) ?? [];
    expect(images.length).toBeGreaterThan(0);

    for (const image of images) {
      // Empty alt is correct for decoration; a missing one leaves a screen
      // reader announcing a file name.
      expect(image, 'no alt attribute').toMatch(/\balt=/);
    }
  });

  /**
   * A button whose only content is an icon or an entity reads as "button" and
   * nothing else. Either it has words, or it says what it does in a label.
   */
  it('gives every button an accessible name', () => {
    const buttons = TEMPLATE.match(/<button\b[^>]*>[\s\S]*?<\/button>/g) ?? [];
    expect(buttons.length).toBeGreaterThan(0);

    for (const button of buttons) {
      const labelled = /aria-label=|aria-labelledby=/.test(button);
      const words = button
        .replace(/<[^>]*>/g, '')
        .replace(/&[a-z]+;|[^\p{L}\p{N}]/gu, '')
        .trim();

      expect(labelled || words.length > 0, `unnamed button: ${button.slice(0, 80)}`).toBe(true);
    }
  });

  /**
   * A control is named by an aria attribute, or by a `<label>` wrapped around
   * it — the second is what this template mostly does, with a visually hidden
   * span inside. An earlier version of this check only looked at the tag's own
   * attributes and reported a correctly labelled store picker as a defect,
   * which is the kind of false positive that gets a whole test deleted.
   */
  it('labels every form control', () => {
    const controls = [...TEMPLATE.matchAll(/<(?:input|select|textarea)\b[^>]*>/g)];

    for (const match of controls) {
      const control = match[0];
      if (/type=["'](?:hidden|submit|button)["']/.test(control)) continue;
      if (/aria-label=|aria-labelledby=/.test(control)) continue;

      // Look back for an unclosed <label>. The template builds its markup by
      // concatenating strings, so the opening tag is a line or two above.
      const before = TEMPLATE.slice(Math.max(0, match.index - 400), match.index);
      const wrapped = before.lastIndexOf('<label') > before.lastIndexOf('</label>');

      expect(wrapped, `unlabelled control: ${control.slice(0, 80)}`).toBe(true);
    }
  });

  /**
   * Checked on the layout rather than the template.
   *
   * The template is published as an artifact, where the host supplies the
   * html, head and body around it — so it has no `<html>` of its own to carry
   * a lang, and asserting otherwise would be asserting about somebody else's
   * markup. The Next.js site is where the real document is written.
   */
  it('declares a language on the document it actually owns', () => {
    const layout = readFileSync(path.resolve(__dirname, '../src/app/layout.tsx'), 'utf8');
    expect(layout).toMatch(/<html[^>]*lang=["']en-ZA["']/);
  });

  it('gives the page a title', () => {
    expect(TEMPLATE).toMatch(/<title>[^<]+<\/title>/);
  });

  /** A viewport that forbids zoom is the single most common mobile a11y failure. */
  it('does not stop anybody zooming', () => {
    const viewport = TEMPLATE.match(/<meta[^>]*name=["']viewport["'][^>]*>/)?.[0] ?? '';
    expect(viewport).not.toMatch(/user-scalable\s*=\s*no/);
    expect(viewport).not.toMatch(/maximum-scale\s*=\s*1/);
  });

  /**
   * Focus has to be visible for a keyboard user to know where they are, and
   * `outline:none` without a replacement is how it stops being.
   */
  it('never removes a focus outline without putting one back', () => {
    const removals = TEMPLATE.match(/outline\s*:\s*(?:none|0)\b/g) ?? [];
    if (removals.length === 0) return;

    expect(TEMPLATE, 'outline removed with no :focus-visible style to replace it').toMatch(
      /:focus-visible/,
    );
  });
});

describe('the React components and the pages', () => {
  const files = [...readdirDeep(COMPONENTS), ...readdirDeep(PAGES)].filter((file) =>
    file.endsWith('.tsx'),
  );

  /**
   * A guard. Both halves of this list are found by walking a directory, and a
   * walk that returned nothing would leave every scan below passing over an
   * empty set forever.
   */
  it('has components and pages to check', () => {
    expect(readdirDeep(COMPONENTS).length).toBeGreaterThan(10);
    expect(readdirDeep(PAGES).length).toBeGreaterThan(10);
  });

  it('gives every image an alt', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const image of source.match(/<(?:img|Image)\b[^>]*\/?>/g) ?? []) {
        expect(image, `${path.basename(file)}: ${image.slice(0, 60)}`).toMatch(/\balt=/);
      }
    }
  });

  /**
   * A div with an onClick is not a button: it is not focusable, does not fire
   * on Enter or Space, and is announced as nothing at all.
   */
  it('does not hang a click handler on something that is not a control', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const offenders = (source.match(/<(?:div|span|li)\b[^>]*onClick[^>]*>/g) ?? []).filter(
        // aria-hidden is the exception, and a real one: an overlay backdrop is
        // not exposed to assistive technology at all, and the keyboard route to
        // the same action is Escape, which the focus trap handles. Requiring a
        // role on it would mean announcing a decorative sheet of grey.
        (element) => !/role=|tabIndex=|aria-hidden=["']true["']/.test(element),
      );

      expect(offenders, `${path.basename(file)} has a clickable non-control`).toEqual([]);
    }
  });
});

/** Every file under a directory, recursively. */
function readdirDeep(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? readdirDeep(full) : [full];
  });
}

/**
 * The screens a customer sees when something has gone wrong.
 *
 * There were none: `notFound()` — which the product route calls deliberately
 * for an unknown slug — landed on the framework's bare default, and any render
 * error showed a white page reading "Application error", with no branding and
 * nothing to press. They are the two screens most likely to be somebody's last
 * impression of the site, and they were the two nobody had written.
 */
describe('the error boundaries', () => {
  const source = (file: string) => readFileSync(path.join(PAGES, file), 'utf8');

  it('exist', () => {
    for (const file of ['not-found.tsx', 'error.tsx', 'global-error.tsx']) {
      expect(existsSync(path.join(PAGES, file)), file).toBe(true);
    }
  });

  /** A dead end is what makes a 404 the end of the visit. */
  it('give a customer somewhere to go', () => {
    expect(source('not-found.tsx')).toMatch(/href="\/menu"/);
    expect(source('error.tsx')).toMatch(/href="\/menu"/);
    expect(source('global-error.tsx')).toMatch(/href="\/"/);
  });

  it('offer a retry where retrying is possible', () => {
    // `reset` re-renders the segment that failed, which fixes the common case
    // of one bad response. A 404 has nothing to retry and offers none.
    expect(source('error.tsx')).toContain('reset');
    expect(source('global-error.tsx')).toContain('reset');
  });

  /**
   * The root layout is what has failed by the time global-error renders, so it
   * cannot use the site chrome, the fonts, or anything that assumes them.
   */
  it('let the last-resort page stand on its own', () => {
    const global = source('global-error.tsx');
    expect(global).toMatch(/<html/);
    expect(global).toMatch(/<body/);
    expect(global).not.toContain('SiteShell');
  });

  /**
   * Styled from the tokens rather than from hex typed into a file nobody
   * expects to look at. The brand checker enforces this across the repository;
   * it is asserted here as well because this is exactly the page where a
   * near-enough red would survive a review.
   */
  it('take the last-resort colours from the tokens', () => {
    expect(source('global-error.tsx')).toContain('BRAND');
  });

  it('keep the error pages out of the index', () => {
    expect(source('not-found.tsx')).toMatch(/robots:\s*\{\s*index:\s*false/);
  });
});
