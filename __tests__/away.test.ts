import { readFileSync } from 'node:fs';
import path from 'node:path';

import { focusManager } from '@tanstack/react-query';
import { handleAppStateChange } from '@/features/system/useAppFocus';

const root = path.join(__dirname, '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

const code = (file: string) =>
  read(file)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

/*
  ───────────────────────────────────────────────────────────────────────────
  The app nobody is looking at.

  Two queries poll: live order tracking every 15 seconds, the active-order
  banner every 30. On a phone that is battery and prepaid data, and
  `useAppFocus` exists because the app was once found refetching both "while
  backgrounded, on the customer's mobile data, indefinitely".

  That fix is guarded by a platform check carrying a claim:

      // On web the focus manager already listens for visibilitychange itself,
      // and AppState never reports anything but 'active'.
      if (Platform.OS === 'web') return;

  An assertion about a third-party library, on the one platform where nothing
  tested it — and the web build is every preview, every demo and every desktop
  customer. `npm run audit:away` counts it against a stub backend:

      watched        2 requests in 40s
      hidden         0
      watched again  3

  **This round found no defect, and that is the result.** The claim was
  load-bearing and unverified; it is now verified. A sweep that confirms
  something is worth the same as one that breaks it, provided it could have
  broken it — which is what the counterfactual below establishes.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — the native half, which is the half this app wrote.
 */
describe('1 — telling the query client when nobody is looking', () => {
  afterEach(() => focusManager.setFocused(undefined));

  it('counts only "active" as in front of the customer', () => {
    handleAppStateChange('active');
    expect(focusManager.isFocused()).toBe(true);
  });

  it('counts "background" as not', () => {
    handleAppStateChange('background');
    expect(focusManager.isFocused()).toBe(false);
  });

  it('counts "inactive" as not, which is the one that is easy to get wrong', () => {
    // iOS reports 'inactive' during an incoming call or in the app switcher.
    // The app is on screen in some sense and is not in front of anybody.
    handleAppStateChange('inactive');
    expect(focusManager.isFocused()).toBe(false);
  });

  it('is not wired up on web, where the library does it already', () => {
    expect(code('src/features/system/useAppFocus.ts')).toMatch(
      /if \(Platform\.OS === 'web'\) return;/,
    );
  });
});

/**
 * FIXTURE 2 — the claim, and the fact that it is now one that was checked.
 */
describe('2 — the web half, which this app only asserted', () => {
  const hook = read('src/features/system/useAppFocus.ts');

  it('records the numbers the sweep measured, beside the claim', () => {
    expect(hook).toMatch(/watched\s+2 requests/);
    expect(hook).toMatch(/hidden\s+0/);
    expect(hook).toMatch(/watched again\s+3/);
  });

  it('records how the zero was shown to be a measurement', () => {
    /*
      The distinction this whole round turns on. A zero can mean "the poll
      stopped" or "this sweep cannot see a poll", and only the counterfactual
      separates them.
    */
    expect(hook).toMatch(/refetchIntervalInBackground: true` reports 3 while hidden/);
  });

  it('does not leave the app polling in the background by configuration', () => {
    // The counterfactual setting must never be committed. It is the one line
    // that would put the original defect back.
    expect(code('src/features/orders/hooks.ts')).not.toMatch(/refetchIntervalInBackground/);
  });

  it('still polls the things that need polling while somebody is watching', () => {
    const hooks = code('src/features/orders/hooks.ts');

    expect(hooks).toMatch(/return 15_000;/);
    expect(hooks).toMatch(/refetchInterval: 30_000,/);
  });

  it('stops polling an order that has finished, without needing focus at all', () => {
    // A completed order is not going to change again, so the interval turns
    // itself off. That is separate from the focus question and must stay.
    expect(code('src/features/orders/hooks.ts')).toMatch(
      /order\.status === 'completed' \|\| order\.status === 'cancelled' \? false : 15_000/,
    );
  });
});

/**
 * FIXTURE 3 — the sweep, and the two attempts it took to hide a tab.
 */
describe('3 — audit:away', () => {
  const audit = read('scripts/audit-away.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:away']).toBe('node scripts/audit-away.mjs');
  });

  it('watches either side of the hidden phase', () => {
    /*
      A screen that never polled would report zero while hidden and prove
      nothing; a poll that never resumed would be a different bug shipped as a
      fix. The middle phase is only a finding because of the two around it.
    */
    expect(audit).toMatch(/const asked = \{ setup: 0, watched: 0, hidden: 0, again: 0 \};/);
    expect(audit).toMatch(/was not measuring a polling screen/);
    expect(audit).toMatch(/live tracking\s*' \+\s*'is dead until they reload/);
  });

  it('says plainly that bringing another tab forward did not work', () => {
    /*
      Tried headless, then headed under a virtual display. Playwright opens each
      page in its own window, so nothing ever occludes anything. The sweep's own
      precondition caught it and refused to report — which is the only reason
      the note in the file is accurate rather than hopeful.
    */
    expect(audit).toMatch(/Not by bringing another tab to the front/);
    expect(audit).toMatch(/headed under a virtual display/);
  });

  it('supplies the browser signal rather than the app’s reaction to it', () => {
    // `visibilityState`, `document.hidden` and a real `visibilitychange` on
    // `document` are the entire interface the platform gives a page for this,
    // and the entire interface TanStack's focus manager consumes.
    expect(audit).toMatch(/Object\.defineProperty\(document, 'visibilityState'/);
    expect(audit).toMatch(/document\.dispatchEvent\(new Event\('visibilitychange'\)\)/);
  });

  it('marks what it stipulates rather than proves', () => {
    // That a browser fires `visibilitychange` when a tab goes to the back is
    // specified behaviour and is not verified here. Saying so is the point.
    expect(audit).toMatch(/What is stipulated rather than proven/);
  });

  it('refuses to report when it cannot hide the tab', () => {
    expect(audit).toMatch(/could not hide the tab/);
    expect(audit).toMatch(/process\.exit\(2\)/);
  });

  it('keeps the order in a state that goes on polling', () => {
    // `useOrder` stops by itself once an order completes, which is correct and
    // would have quietly ended the measurement halfway through.
    expect(audit).toMatch(/status: 'out_for_delivery'/);
    expect(audit).toMatch(/stops polling by itself once the status reaches/);
  });

  it('gives each phase longer than the interval it is measuring', () => {
    // 40 seconds against a 15-second poll. Shorter and a zero would be
    // ambiguous between "it stopped" and "it had not come round yet".
    expect(audit).toMatch(/const PHASE_MS = 40_000;/);
  });
});
