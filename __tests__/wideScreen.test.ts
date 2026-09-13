import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

function sourceFiles(dir = 'src'): string[] {
  return readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const here = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(here);
    return /\.tsx?$/.test(entry.name) ? [here] : [];
  });
}

/*
  ───────────────────────────────────────────────────────────────────────────
  A screen wider than a phone.

  `app.json` says `"orientation": "portrait"` and it also says
  `"supportsTablet": true`, and those two together are this whole round. A
  portrait iPad is 834 points across, a landscape one 1194 — two to three times
  every width this repository had ever swept. `audit:screens` uses 390 and 320.
  `audit:text-scale` uses 320. Nothing had ever been wider than a large phone.

  `npm run audit:wide` renders twelve screens at both iPad shapes and finds one
  defect: `product/[id]` sized its hero as `Dimensions.get('window').width *
  1.05`, read once at module scope. On a landscape iPad that is a **1254-point
  image in an 834-point viewport** — a customer opens a product and can see the
  picture and nothing else.

  Two separate mistakes in one line, and they need different fixes:

    the number was captured once, so it is also stale on any resize — a browser
    drag on the web build, a Split View on a tablet;

    and it had no ceiling, so a wider screen made it taller without limit.

  The ceiling is *derived* rather than chosen. On the 390×844 phone this was
  drawn for, `width * 1.05` is 410 points of an 844-point screen — a little
  under half. Half the viewport height says the same thing in a way that
  survives a wider screen, and `audit:screens` confirms the phone renders
  exactly as it did.

  ── and the round after ──

  That fix left six other screens reading the window once at module scope, and
  a fixture below counted them by name so the number could not grow quietly.
  It is empty now. Two of the six did not need a width at all — `'100%'` says
  "as wide as the screen" without measuring anything — and the other four ask
  the hook.

  One of the four was more than a layout mark. Onboarding uses the page width
  three times: how wide a slide is drawn, the divisor that turns a scroll
  offset back into a slide number, and the offset Next scrolls to. Stale, all
  three disagree at once and the carousel desynchronises from its own dots.

  What is left at both iPad shapes is not a defect — nothing overflows — it is
  a phone design stretched to 1194 points, and that goes to `audit:launch`
  rather than being decided here. Same boundary this sweep drew for itself,
  applied to itself.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the hero, at every shape the app supports.
 *
 * The sum itself, run here rather than described, because the whole finding is
 * that one expression gives a sensible answer on one device and an absurd one
 * on another.
 */
describe('1 — a hero that fits the screen it is on', () => {
  const heroHeight = (width: number, height: number) => Math.min(width * 1.05, height * 0.5);

  const DEVICES: [string, number, number][] = [
    ['iPhone SE', 320, 568],
    ['iPhone 14', 390, 844],
    ['iPhone 14 Pro Max', 430, 932],
    ['iPad portrait', 834, 1194],
    ['iPad landscape', 1194, 834],
    ['a Split View half', 507, 834],
  ];

  it.each(DEVICES)('%s never gives the hero more than half the screen', (_name, width, height) => {
    expect(heroHeight(width, height)).toBeLessThanOrEqual(height * 0.5);
  });

  it('leaves the phones this was drawn for exactly as they were', () => {
    // 409.5 of 844 and 451.5 of 932 — both already under half, so the cap does
    // not touch them.
    for (const [, width, height] of [DEVICES[1]!, DEVICES[2]!]) {
      expect(heroHeight(width, height)).toBeCloseTo(width * 1.05, 5);
    }
  });

  it('does tighten the smallest phone, and that is worth saying out loud', () => {
    /*
      The one place this is a change rather than a fix, found by this fixture
      when it was written to claim the opposite.

      An iPhone SE is 320×568, so the old sum gave a 336-point hero — 59% of the
      screen, the only phone where the existing design was already past the
      ratio it holds everywhere else. The cap brings it to 284.

      Kept rather than carved out, because a carve-out needs a width threshold
      and that would be a number I invented; this one is the design's own ratio
      applied consistently. `audit:screens` sweeps 320pt and is green with it.
    */
    const [, width, height] = DEVICES[0]!;

    expect(heroHeight(width, height)).toBe(284);
    expect(heroHeight(width, height)).toBeLessThan(width * 1.05);
  });

  it('bites on every shape wider than a phone', () => {
    for (const [, width, height] of DEVICES.slice(3)) {
      expect(heroHeight(width, height)).toBeLessThan(width * 1.05);
    }
  });

  it('is a ratio rather than a fixed number, so no device is special-cased', () => {
    // A hard cap in points would have needed a device list to stay sensible,
    // and that list is the thing that goes stale when a new iPad ships.
    for (const [, width, height] of DEVICES) {
      expect(heroHeight(width, height)).toBe(Math.min(width * 1.05, height * 0.5));
    }
  });

  it('is the expression the screen actually uses', () => {
    expect(code('src/app/product/[id].tsx')).toMatch(/Math\.min\(width \* 1\.05, height \* 0\.5\)/);
  });
});

/**
 * FIXTURE 2 — read when it is needed, not once at import.
 */
describe('2 — a window that can change', () => {
  it('asks the hook rather than the module-scope snapshot', () => {
    const screen = code('src/app/product/[id].tsx');

    expect(screen).toMatch(/useWindowDimensions/);
    expect(screen).not.toMatch(/Dimensions\.get\('window'\)/);
  });

  it('says why a constant could not have worked', () => {
    const screen = read('src/app/product/[id].tsx');

    expect(screen).toMatch(/the number has to change when the\s+\* window does/);
    expect(screen).toMatch(/Split View/);
  });

  /**
   * The rest of the app, and then none of it.
   *
   * When this fixture was written it listed six other screens that still read
   * the window once at module scope, so the number could not grow quietly. It
   * is empty now: the round after named them one at a time and closed the
   * class, and the list is the better kind of empty — a thing that was counted
   * until it reached zero rather than a check nobody ever wrote.
   *
   * Kept as an assertion rather than deleted, because the next screen that
   * needs a width will reach for the same expression, and the whole point of
   * closing a class is that it stays closed.
   */
  it('no longer reads the window once anywhere, and says so by counting', () => {
    const captured = sourceFiles().filter((file) =>
      code(file).includes("Dimensions.get('window')"),
    );

    expect(captured.sort()).toEqual([]);
  });

  it('reaches for the hook on every screen that needs a width', () => {
    // The six that were on the list, by name, so an accidental revert is a
    // failure here rather than a slow drift back.
    const migrated = [
      'src/app/(onboarding)/welcome.tsx',
      'src/app/(tabs)/home.tsx',
      'src/app/(tabs)/rewards.tsx',
      'src/app/offers/index.tsx',
    ];
    for (const file of migrated) {
      expect(code(file)).toMatch(/useWindowDimensions\(\)/);
    }
  });

  it('drops the number entirely where full bleed is the whole intent', () => {
    /*
      Two of the six did not need a width at all. `offers/[id]` and
      `rewards/[id]` used the window width to say "as wide as the screen" for
      a hero that is a direct child of the scroll view — which `'100%'` says
      without measuring anything, and so without being able to measure it at
      the wrong moment.

      Worth separating from the other four: a hook that re-reads is the fix
      for a number you genuinely need, and no number at all is the better fix
      when you never did.
    */
    for (const file of ['src/app/offers/[id].tsx', 'src/app/rewards/[id].tsx']) {
      expect(code(file)).toMatch(/hero: \{ width: '100%' \}/);
      expect(code(file)).not.toMatch(/useWindowDimensions/);
    }
  });

  it('fixes the carousel that would have desynchronised, not just its width', () => {
    /*
      Onboarding was the one where a stale width is more than a layout mark.
      `welcome.tsx` uses the page width three times — how wide a slide is
      drawn, the divisor that turns a scroll offset back into a slide number,
      and the offset Next scrolls to — so on a resize the slides stop filling
      the viewport, the dots and the headline stop agreeing with the picture,
      and Next lands between two slides.

      All three now come from the same hook, so they cannot disagree with each
      other or with the window.
    */
    const screen = code('src/app/(onboarding)/welcome.tsx');

    expect(screen).toMatch(/setIndex\(Math\.round\(offset \/ width\)\)/);
    expect(screen).toMatch(/scrollToOffset\(\{ offset: \(index \+ 1\) \* width/);
    expect(screen).toMatch(/<View style=\{\{ width \}\}>/);
    // And the handlers have to be told, or they close over the first width.
    expect(screen).toMatch(/\},\s*\[width\],\s*\);/);
    expect(screen).toMatch(/\[isLastSlide, index, width, completeOnboarding, router\]/);
  });

  it('stops deriving a constant from a number it then cancels out', () => {
    // `aspectRatio={SCREEN_WIDTH / (SCREEN_WIDTH * 1.25)}` is 1/1.25 with the
    // width cancelling itself. It read as though it depended on the screen,
    // which is how it survived a round that was looking for exactly that.
    expect(code('src/app/(onboarding)/welcome.tsx')).toMatch(/aspectRatio=\{1 \/ 1\.25\}/);
  });
});

/**
 * FIXTURE 3 — the sweep, and the case the other twelve could not see.
 */
describe('3 — audit:wide', () => {
  const audit = read('scripts/audit-wide.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:wide']).toBe('node scripts/audit-wide.mjs');
  });

  it('sweeps both shapes an iPad actually has', () => {
    expect(audit).toMatch(/width: 834, height: 1194/);
    expect(audit).toMatch(/width: 1194, height: 834/);
  });

  it('carries the resize, which every fixed-size case is blind to', () => {
    // A context opened at the size it measures can never see a number captured
    // once and kept. Only a window that changes after load can.
    expect(audit).toMatch(/setViewportSize\(\{ width: 1194, height: 834 \}\)/);
    expect(audit).toMatch(/Something read the window once and kept it/);
  });

  it('excludes what a carousel is supposed to do', () => {
    /*
      The correction this sweep needed. Its first run reported Home's "Popular
      right now" row as running 890px past the edge — which is what horizontal
      scrolling *is*. `audit:screens` has carried this filter since it was
      written; this one did not, and reported a finding about itself.
    */
    expect(audit).toMatch(/const inScroller = \(node\) =>/);
    expect(audit).toMatch(/that is what[\s\S]{0,20}horizontal scrolling is/);
  });

  it('hands the design decision on rather than making one', () => {
    /*
      The boundary this sweep drew for itself, now honoured in the other
      direction. A hero that runs *off* the screen is a defect and was fixed in
      the same round the sweep was written. A hero that fills 85% of a landscape
      iPad is not a defect — it is a phone design on a tablet — and choosing
      between a centred max width, a second column and larger type is drawing
      somebody's app for them.

      So it goes where every other question like it goes: `audit:launch`, under
      "only you can supply", guarded on the flag that makes it a question at
      all.
    */
    const launch = read('scripts/audit-launch-readiness.mjs');

    expect(launch).toContain('if (app.ios?.supportsTablet === true) {');
    expect(launch).toContain("'Tablet layout'");
    expect(launch).toContain('**nothing overflows ');
    expect(launch).toContain('reach **85% of ');
    expect(launch).toContain('`supportsTablet: false` and ship phone-only');
    // It must not claim a defect. The sweep is green and the item says so.
    expect(launch).toContain('so it is usable today');
  });

  it('reports line length rather than failing on it', () => {
    // Past about 80 characters is a legibility standard; what to do about it —
    // a max width, a second column, larger type — is a layout decision and
    // belongs to whoever owns the design, not to this sweep.
    expect(audit).toMatch(/reported, not failed on/);
    expect(audit).toMatch(/design is not[\s\S]{0,20}mine to invent/);
  });
});
