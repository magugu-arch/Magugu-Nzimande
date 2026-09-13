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
  The same customer, in two tabs.

  Every sweep in this repository had driven one page. That is the right model
  for a phone and the wrong one for the web build, which is what every preview,
  every demo and every desktop customer uses — and where opening a second tab
  costs one keystroke.

  Four stores persist into `localStorage` and nothing read it twice. A tab
  rehydrated once, at load, and then believed what it had read for as long as
  it stayed open. There was no `storage` listener anywhere in `src`.

  `npm run audit:tabs` opens two pages of one browser profile and measures the
  second while the first acts on it. Both cases failed:

      tab A places the order   B still showed six basket lines and a live Pay
                               button, for food that had just been paid for

      tab A signs out          B still showed the customer's order history, on
                               a screen that requires an account

  The second matters more. A duplicate order is money and can be refunded; a
  signed-out session still on screen is somebody else's name, address and order
  history on a shared laptop, and no refund covers that.
  ───────────────────────────────────────────────────────────────────────────
*/

/**
 * FIXTURE 1 — every store that persists is covered, derived rather than listed.
 */
describe('1 — nothing persists without being watched', () => {
  /** The keys the stores actually persist under, read from the stores. */
  const persisted = readdirSync(path.join(root, 'src/store'))
    .filter((file) => file.endsWith('.ts'))
    .flatMap((file) => [...read(`src/store/${file}`).matchAll(/name: '(bbq\.[\w.]+)'/g)])
    .map((match) => match[1] as string)
    .sort();

  const sync = code('src/features/system/useCrossTabSync.ts');

  it('finds the persisted stores by what they do, not by a list', () => {
    // A list is the thing that goes stale: the fifth store to persist is
    // written by somebody who has never read this file.
    expect(persisted).toEqual(['bbq.auth', 'bbq.cart', 'bbq.favourites', 'bbq.fulfilment']);
  });

  it.each(persisted)('%s is rehydrated when another tab writes it', (key) => {
    expect(sync).toContain(`key: '${key}'`);
    expect(sync).toMatch(new RegExp(`key: '${key.replace('.', '\\.')}', rehydrate:`));
  });

  it('watches nothing it cannot rehydrate', () => {
    // The other direction: a key listed here with no store behind it would be
    // a listener that fires and does nothing, which is worse than none.
    const watched = [...sync.matchAll(/key: '(bbq\.[\w.]+)'/g)].map((m) => m[1] as string).sort();
    expect(watched).toEqual(persisted);
  });
});

/**
 * FIXTURE 2 — the listener, and the loop it would otherwise start.
 */
describe('2 — hearing the other tab', () => {
  const sync = read('src/features/system/useCrossTabSync.ts');

  it('listens for the event the browser already sends', () => {
    expect(code('src/features/system/useCrossTabSync.ts')).toMatch(
      /window\.addEventListener\('storage', onStorage\)/,
    );
  });

  it('removes the listener when it goes away', () => {
    expect(code('src/features/system/useCrossTabSync.ts')).toMatch(
      /return \(\) => window\.removeEventListener\('storage', onStorage\)/,
    );
  });

  it('is web only, decided by platform rather than by feature check', () => {
    // Not because native could not do it — because on native there is no
    // second tab, and a listener that can never fire should not ship.
    expect(code('src/features/system/useCrossTabSync.ts')).toMatch(
      /if \(Platform\.OS !== 'web'\) return;/,
    );
  });

  it('survives a runtime with no window at all', () => {
    // Static rendering and the test runner both evaluate this module.
    expect(code('src/features/system/useCrossTabSync.ts')).toMatch(/typeof window === 'undefined'/);
  });

  it('stops the ping-pong it would otherwise start', () => {
    /*
      Rehydrating sets state, setting state makes persist write it back, and
      that write fires a `storage` event in the other tab — which rehydrates,
      writes back, and so on. The value is identical every lap, so remembering
      it and ignoring a repeat ends the exchange after one.
    */
    expect(code('src/features/system/useCrossTabSync.ts')).toMatch(
      /if \(lastSeen\.get\(event\.key\) === event\.newValue\) return;/,
    );
    expect(sync).toMatch(/ends\s+\* the exchange after one lap/);
  });

  it('says why a flag would not have done', () => {
    // Two tabs each holding "I am currently applying" still hand the ball back
    // and forth: each one's write arrives after the other has finished.
    expect(sync).toMatch(/A flag would not do/);
  });

  it('handles the browser saying "all of it"', () => {
    // `localStorage.clear()` fires one event with `key: null`.
    expect(code('src/features/system/useCrossTabSync.ts')).toMatch(
      /event\.key === null \? OWNERS :/,
    );
  });
});

/**
 * FIXTURE 3 — the cached answers a departing session leaves behind.
 */
describe('3 — a session that ended in another tab', () => {
  const sync = code('src/features/system/useCrossTabSync.ts');

  it('clears the query cache when the session goes', () => {
    /*
      Rehydrating makes the screens correct — every gated screen reads
      `useIsSignedOut` and puts up its wall. It does nothing about the cache,
      which still holds the orders, addresses and loyalty balance fetched as
      the customer who just signed out.
    */
    expect(sync).toMatch(/queryClient\.clear\(\)/);
  });

  it('clears it only on the way out', () => {
    // Somebody signing *in* on the other tab has nothing cached worth
    // dropping, and clearing then throws away a warm menu for no reason.
    expect(sync).toMatch(
      /if \(wasSignedIn && !useAuthStore\.getState\(\)\.isAuthenticated\) \{\s*queryClient\.clear\(\);/,
    );
  });

  it('reads the flag before rehydrating, not after', () => {
    // Otherwise `wasSignedIn` is the value that was just written by the other
    // tab, the comparison is against itself, and the branch never runs.
    const body = sync;
    expect(body.indexOf('const wasSignedIn')).toBeLessThan(body.indexOf('owner.rehydrate()'));
  });

  it('is wired into the app beside the other session hook', () => {
    const layout = code('src/app/_layout.tsx');

    expect(layout).toMatch(/useCrossTabSync\(\);/);
    expect(layout).toMatch(/useSessionExpiry\(\);\s*\n\s*useCrossTabSync\(\);/);
  });
});

/**
 * FIXTURE 4 — the sweep, and the case of it that could not fail.
 */
describe('4 — audit:tabs', () => {
  const audit = read('scripts/audit-tabs.mjs');

  it('is registered so it runs', () => {
    const scripts = JSON.parse(read('package.json')).scripts as Record<string, string>;
    expect(scripts['audit:tabs']).toBe('node scripts/audit-tabs.mjs');
  });

  it('is two pages of one context, which is what two tabs are', () => {
    /*
      Two *contexts* would be two different browsers, sharing no storage and no
      storage events, and would prove nothing about this.
    */
    expect(audit).toMatch(
      /const a = await context\.newPage\(\);\s*\n\s*const b = await context\.newPage\(\);/,
    );
    expect(audit).toMatch(/Two \*contexts\* would be two different browsers/);
  });

  it('judges the second tab on what it draws', () => {
    /*
      The correction this sweep needed. Its sign-out case first accepted
      `storedAuth !== true` and passed — of course it did: that is tab A's
      write, sitting in the storage both tabs read. It says nothing about
      whether B noticed.
    */
    expect(audit).toMatch(/ok: afterSignOut\.signInWall,/);
    expect(audit).toMatch(/A check that reads\s+the thing the other tab changed/);
  });

  it('puts the second tab where a sign-in wall can appear', () => {
    // `/cart` is not gated — a signed-out customer has a basket too — so it
    // could never show one, and using it there made the case unfalsifiable.
    expect(audit).toMatch(/await go\(b, '\/orders'\);/);
    expect(audit).toMatch(/could\s+never show a sign-in wall/);
  });

  it('proves the starting state of both cases', () => {
    expect(audit).toMatch(/the second tab opened on an empty basket/);
    expect(audit).toMatch(/already showing the sign-in wall before tab A signed/);
    expect(audit).toMatch(/tab A did not actually sign out/);
  });

  it('gives the second tab far longer than it needs', () => {
    // A `storage` event lands on the next turn of the other tab's event loop.
    // Four seconds is generous by three orders of magnitude, on purpose: a
    // sweep that reported "B did not update" after 50ms would be a sweep about
    // its own timing.
    expect(audit).toMatch(/const NOTICE_MS = 4000;/);
  });
});
