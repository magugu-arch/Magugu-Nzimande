import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  The first five minutes, which existed only in fragments.

  Every sweep in this repository starts in the middle — seeding a customer or
  navigating straight to the route it is about to measure. Correct for each of
  them, and it left the sequence every new customer actually walks undriven.

  `audit:single` opened the app at its own entry point for the first time last
  round and found the welcome carousel broken in a way that had shipped in
  thirty-nine builds. The screen after it had still never been opened.

  `audit:firstrun` walks the whole thing in order — splash, carousel, sign-in,
  continue as guest, location permission, home — and then asks the question a
  single pass cannot: `postAuthRoute` promises in its own doc that once the
  permission has been answered the app never asks again on sign-in, and nothing
  had tested it.

  Everything the sweep drove came back sound, including the two things most
  worth doubting: `requestLocation` marks the permission asked before it opens
  the OS sheet, so a customer who taps "Use my location" and then denies is
  still recorded as asked; and `forgetPerson` deliberately keeps that flag
  through a sign-out, because whether the sheet has been shown is a fact about
  the handset rather than about whoever is holding it.

  These fixtures hold the parts of that which a sweep cannot: the sweep proves
  the journey works today, and the fixtures keep the reasoning attached to the
  code, so the next person to "tidy up" one of those two lines finds out why it
  is there before they remove it.
  ───────────────────────────────────────────────────────────────────────────
*/

describe('1 — asked once, and only once', () => {
  it('records the asking before the sheet can be declined, not after', () => {
    /*
      `markAsked()` sits above the await on purpose. Below it, a customer who
      taps "Use my location" and then says no to the OS is never recorded as
      having been asked — so the pre-permission screen returns on their next
      sign-in, and on the one after that. An app that asks every time is one
      whose location permission gets switched off for good.
    */
    const hook = code('src/features/stores/hooks.ts');
    const request = /const requestLocation = useCallback\([\s\S]*?\n {2}\}/.exec(hook)?.[0] ?? '';

    expect(request).toMatch(/markAsked\(\)/);
    expect(request.indexOf('markAsked()')).toBeLessThan(
      request.indexOf('requestForegroundPermissionsAsync'),
    );
  });

  it('records it on the decline too', () => {
    // "Not now" is an answer. A screen that only remembers "yes" asks the
    // people who said no every single time.
    const screen = code('src/app/(onboarding)/location.tsx');
    const skip = /const handleSkip = useCallback\([\s\S]*?\n {2}\}/.exec(screen)?.[0] ?? '';

    expect(skip).toMatch(/markAsked\(\)/);
  });

  it('keeps the flag through a sign-out', () => {
    /*
      `forgetPerson` clears where somebody lives and keeps whether the handset
      has seen the sheet. The two look alike and are not: one is about a person,
      the other about a device that may be handed to somebody else.
    */
    const store = read('src/store/fulfilmentStore.ts');
    /*
      Anchored on the implementation, not the interface. `forgetPerson: () =>`
      appears twice in this file — once as a type declaration and once as the
      function — and the first version of this matched the declaration, then
      reported that it does not mention `locationPermissionAsked`. Which was
      true, and about the wrong four lines.
    */
    const forget =
      /forgetPerson: \(\) =>\s*\n\s*set\(\{[\s\S]*?isReadyForCheckout: \(\) => get/.exec(
        store,
      )?.[0] ?? '';

    expect(forget).toMatch(/coordinates: null/);
    expect(forget).not.toMatch(/locationPermissionAsked/);
    // The phrase wraps across two comment lines, so match the half that sits
    // on one of them rather than a sentence that only exists unwrapped.
    expect(forget).toMatch(/about the handset, not about whoever is holding it/);
  });

  it('routes on either half of the question', () => {
    // Coordinates already in hand is as good an answer as having been asked —
    // somebody who set a location by other means should not meet the screen.
    expect(code('src/features/auth/postAuthRoute.ts')).toMatch(
      /locationPermissionAsked \|\| coordinates !== null/,
    );
  });
});

describe('2 — audit:firstrun', () => {
  const audit = read('scripts/audit-firstrun.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:firstrun']).toBe('node scripts/audit-firstrun.mjs');
  });

  it('walks the journey in order rather than jumping to a screen', () => {
    /*
      The whole point. A sweep that navigated straight to the permission screen
      would prove the screen renders and nothing about whether anybody can get
      to it — which is exactly the gap that hid the carousel.
    */
    const journey = /const JOURNEY = \[[\s\S]*?\n\];/.exec(audit)?.[0] ?? '';

    expect(journey).toMatch(/welcome carousel/);
    expect(journey.indexOf('sign-in')).toBeGreaterThan(journey.indexOf('welcome carousel'));
    expect(journey.indexOf('location permission')).toBeGreaterThan(journey.indexOf('sign-in'));
    expect(journey.indexOf("'home'")).toBeGreaterThan(journey.indexOf('location permission'));
  });

  it('does not hard-code how many slides the carousel has', () => {
    // The deck's length is the app's business. A sweep that knew it would
    // start lying the day somebody adds a slide.
    expect(audit).toMatch(/press < 8/);
    expect(audit).toMatch(/hard-codes it starts lying/);
  });

  it('drives both answers to the permission, not just the easy one', () => {
    // A pre-permission screen whose decline is a dead end is worse than no
    // screen, and only one of the two buttons is on the happy path.
    expect(audit).toMatch(/answerLocationWith/);
    expect(audit).toMatch(/location-allow/);
    expect(audit).toMatch(/location-skip/);
    expect(audit).toMatch(/grantPermissions\(\['geolocation'\]\)/);
  });

  it('asks the second-entry question through the door the promise stands behind', () => {
    /*
      This check could not fail, and a counterfactual is the only reason anyone
      knows. The first version opened a second page at `/`; that goes through
      the splash, which branches on `hasCompletedOnboarding` and reaches Home
      without ever calling `postAuthRoute`. Run against a build with
      `markAsked()` deleted from both call sites, it still reported "went
      straight to Home" — measuring the onboarding flag while claiming to
      measure the location one.

      Entering through sign-in is what a returning customer does and the only
      path `postAuthRoute` is on. With that corrected, the same broken build
      fails with the right sentence.
    */
    expect(audit).toMatch(/BASE \+ '\/sign-in'/);
    expect(audit).toMatch(/sign-in-guest/);
    expect(audit).toMatch(/askedAgain/);
    expect(audit).toMatch(/never calling `postAuthRoute`|without ever calling `postAuthRoute`/);
  });

  it('separates "asked again" from "went nowhere"', () => {
    // Not finding the permission screen is not the same as arriving. A check
    // that treats absence as success passes on a blank page.
    expect(audit).toMatch(/reachedHome/);
    expect(audit).toMatch(/reached neither Home nor the permission screen/);
  });

  it('names the screen it stalled on', () => {
    // "Onboarding is broken" is not something anybody can act on.
    expect(audit).toMatch(/stalledOn/);
    expect(audit).toMatch(/the screen showed/);
  });
});

describe('3 — the sweep is registered where sweeps are listed', () => {
  it('appears in the README and the handover', () => {
    expect(read('README.md')).toMatch(/audit:firstrun/);
    expect(read('HANDOVER.md')).toMatch(/audit:firstrun/);
  });

  it('is one of the sweeps the scripts directory actually holds', () => {
    expect(readdirSync(path.join(root, 'scripts'))).toContain('audit-firstrun.mjs');
  });
});
