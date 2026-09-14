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

/**
 * The selector every seeded sweep leans on, read from the helper rather than
 * copied here. Two copies of a detector is how a detector stops matching.
 */
const SIGN_IN_WALL = /export const SIGN_IN_WALL = '(.+)';/.exec(
  read('scripts/lib/preconditions.mjs'),
)?.[1] as string;

/** Does this `testID` satisfy the selector, without a browser to ask? */
const detectable = (testID: string) =>
  SIGN_IN_WALL.split(', ').some((clause) => {
    const exact = /^\[data-testid="(.+)"\]$/.exec(clause);
    if (exact) return testID === exact[1];
    const suffix = /^\[data-testid\$="(.+)"\]$/.exec(clause);
    return suffix ? testID.endsWith(suffix[1] as string) : false;
  });

/*
  ───────────────────────────────────────────────────────────────────────────
  Every gated screen, opened cold by somebody with no account.

  `audit:screens` signs in before it sweeps, and says why: "an account screen
  swept in its signed-out state is not the screen anybody uses." True of the
  screens, and it left a gap underneath — nothing had driven the app from a
  cold start with empty storage, which is what a push notification, a shared
  link and a browser bookmark all produce.

  What the gap hid was not a broken screen. It was a **broken detector**.

  `lib/preconditions.mjs` decides whether a sweep is looking at a signed-out
  app with one selector, and its comment claimed "a seventh screen is covered
  whichever convention it picks". The seventh screen existed. `AccountRequired`
  was modelled on Profile's wall — the component's own doc says "Profile had it
  right and the others had nothing" — and the round that wrote it gave the
  component to the six screens with no gate and left the original standing
  under `profile-guest`, which the selector does not match.

  So the component written to stop seven copies of a block shipped with one
  copy left; it was the block it was copied from; and the detector every seeded
  sweep trusts could not see it. A sweep asserting `signedIn: true` there would
  have passed its own precondition and measured a signed-out app — the one
  failure that file exists to prevent.

  Profile goes through `AccountRequired` now. These fixtures are about making
  sure the claim stays true without anybody having to remember it.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — every sign-in wall, derived, and every one of them detectable.
 */
describe('1 — a wall the sweeps can see', () => {
  /**
   * Every `testID` handed to `AccountRequired`, read from the call sites.
   *
   * Derived rather than listed: the eighth screen to need a gate is written by
   * somebody who has never opened this file, and a list would not know.
   */
  const walls = sourceFiles()
    .filter((file) => file !== 'src/features/system/AccountRequired.tsx')
    .flatMap((file) => {
      const source = code(file);
      return [...source.matchAll(/<AccountRequired[\s\S]{0,400}?\/>/g)].map((match) => ({
        file,
        testID: /testID="([^"]+)"/.exec(match[0])?.[1],
      }));
    });

  it('finds every gated screen by what it renders, not by name', () => {
    expect(walls.map((wall) => wall.testID).sort()).toEqual([
      'address-signed-out',
      'notifications-signed-out',
      'orders-signed-out',
      'payment-methods-signed-out',
      'profile-signed-out',
      'rewards-signed-out',
      'vouchers-signed-out',
    ]);
  });

  it.each(walls.map((wall) => [wall.testID ?? '(none)', wall.file]))(
    '%s is a wall the shared selector can find',
    (testID) => {
      expect(detectable(testID)).toBe(true);
    },
  );

  it('reads the selector from the helper rather than restating it', () => {
    // Two copies of a detector is how a detector stops matching. This fixture
    // fails if the helper's selector is renamed or reshaped, which is right.
    expect(SIGN_IN_WALL).toBe('[data-testid="account-required"], [data-testid$="-signed-out"]');
  });

  it('would reject the spelling that was actually shipped', () => {
    // The counterfactual, stated as an assertion. `profile-guest` was a real
    // sign-in wall for as long as `AccountRequired` has existed, and nothing
    // could see it.
    expect(detectable('profile-guest')).toBe(false);
    expect(detectable('profile-signed-out')).toBe(true);
  });

  it('does not mistake the guest button on the sign-in screen for a wall', () => {
    /*
      Why the selector was not simply broadened to `$="-guest"`. `sign-in-guest`
      is the "Continue as guest" button, on a screen that is working perfectly.
      A detector that fired there would report a wall on every cold visit to
      sign-in, and `audit:cold` sweeps that route as a control for exactly this.
    */
    expect(detectable('sign-in-guest')).toBe(false);
    expect(code('src/app/(auth)/sign-in.tsx')).toMatch(/label="Continue as guest"/);
  });
});

/**
 * FIXTURE 2 — one component, and now actually one.
 */
describe('2 — no hand-rolled walls left', () => {
  it('leaves the sentence in the component that composes it', () => {
    // `AccountRequired` builds "Sign in to see your <title>" from the title.
    // A screen writing that sentence itself is a seventh copy starting again.
    const handRolled = sourceFiles()
      .filter((file) => file !== 'src/features/system/AccountRequired.tsx')
      .filter((file) => /title="Sign in to see your/.test(code(file)));

    expect(handRolled).toEqual([]);
  });

  it('has Profile going through the component it was the model for', () => {
    const profile = code('src/app/account/profile.tsx');

    expect(profile).toMatch(/<AccountRequired/);
    expect(profile).toMatch(/testID="profile-signed-out"/);
  });

  it('keeps the null check that the shared predicate does not give it', () => {
    /*
      `useIsSignedOut` asks whether the screen should show account data —
      `!isAuthenticated || isGuest`. It does not narrow `user`, and everything
      below the guard dereferences it. Dropping the null check to "tidy up"
      would compile only until somebody removed the non-null assertions.
    */
    expect(code('src/app/account/profile.tsx')).toMatch(/if \(signedOut \|\| user === null\)/);
  });

  it('records in the helper why the claim is no longer only a claim', () => {
    const helper = read('scripts/lib/preconditions.mjs');

    expect(helper).toMatch(/the seventh screen already existed/);
    expect(helper).toMatch(/coldStart\.test\.ts` derives every sign-in wall/);
  });
});

/**
 * FIXTURE 3 — the sweep, and the control that makes its green mean something.
 */
describe('3 — audit:cold', () => {
  const audit = read('scripts/audit-cold.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:cold']).toBe('node scripts/audit-cold.mjs');
  });

  it('asks the shared selector rather than its own copy of one', () => {
    // The whole finding is that the shared selector could not see a wall. A
    // sweep with its own selector would have missed it too, or found it and
    // proved nothing about the sweeps that matter.
    expect(audit).toMatch(/import \{ SIGN_IN_WALL \} from '\.\/lib\/preconditions\.mjs'/);
  });

  it('sweeps ungated routes as the control', () => {
    // A selector that fires on an ordinary screen would make every gated line
    // above it worthless, and nothing else in the run would show that.
    expect(audit).toMatch(/\{ route: '\/menu', gated: false \}/);
    expect(audit).toMatch(/\{ route: '\/sign-in', gated: false \}/);
    expect(audit).toMatch(/every line above is worthless/);
  });

  it('opens each route in its own context, which is what cold means', () => {
    expect(audit).toMatch(/const context = await browser\.newContext\(\{/);
    expect(audit).toMatch(/the second route onwards would no longer be a first visit/);
  });

  it('proves storage really was empty rather than assuming it', () => {
    expect(audit).toMatch(/key\.startsWith\('bbq\.auth'\)/);
    expect(audit).toMatch(/this was not a \` \+\s*\`cold start/);
  });
});
