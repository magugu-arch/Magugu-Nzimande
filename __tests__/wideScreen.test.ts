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
   * The rest of the app, stated rather than hidden.
   *
   * Six other screens still read the window once at module scope. `audit:wide`
   * renders all of them at both iPad shapes and none of them overflows, so
   * they are not defects today — what they are is a latent version of the same
   * mistake, and a fixture that pretended otherwise would be the lie. This one
   * counts them, so the number cannot grow quietly.
   */
  it('counts what still reads the window once, so it cannot grow unnoticed', () => {
    const captured = sourceFiles().filter((file) =>
      code(file).includes("Dimensions.get('window')"),
    );

    expect(captured.sort()).toEqual([
      'src/app/(onboarding)/welcome.tsx',
      'src/app/(tabs)/home.tsx',
      'src/app/(tabs)/rewards.tsx',
      'src/app/offers/[id].tsx',
      'src/app/offers/index.tsx',
      'src/app/rewards/[id].tsx',
    ]);
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

  it('reports line length rather than failing on it', () => {
    // Past about 80 characters is a legibility standard; what to do about it —
    // a max width, a second column, larger type — is a layout decision and
    // belongs to whoever owns the design, not to this sweep.
    expect(audit).toMatch(/reported, not failed on/);
    expect(audit).toMatch(/design is not[\s\S]{0,20}mine to invent/);
  });
});
