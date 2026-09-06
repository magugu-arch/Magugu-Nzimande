import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { NetInfoState } from '@react-native-community/netinfo';
import { toStatus } from '@/features/system/useNetworkStatus';
import { config } from '@/constants/config';

const code = (file: string) =>
  readFileSync(path.join(__dirname, '..', file), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

const netInfo = (over: Partial<NetInfoState>): NetInfoState =>
  ({
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {},
    ...over,
  }) as NetInfoState;

/**
 * 1 and 2 — an app that is online, saying it is offline.
 *
 * The banner is a clip container that animates its height between 0 and its
 * measured size, and the bar inside it was mounted the whole time. Collapsed to
 * nothing it is invisible, and it was taken to be gone. It was not: the
 * sentence sat in the tree of every screen of a working app, inside a `View`
 * marked `accessibilityRole="alert"`.
 */
describe('the offline bar on an app that is online', () => {
  it('renders nothing at all inside the clip', () => {
    const banner = code('src/components/system/OfflineBanner.tsx');

    expect(banner).toMatch(/\{isOffline \? \(/);
    // The clip stays — it is what animates. Only its contents are conditional.
    expect(banner).toMatch(/testID="offline-banner"/);
  });

  /**
   * An alert is a thing a screen reader is entitled to announce on sight. The
   * label was already blanked when online, which helped nothing: the `Text`
   * inside still carried the whole sentence.
   */
  it('does not leave an alert role in the tree with a sentence under it', () => {
    const banner = code('src/components/system/OfflineBanner.tsx');
    const alertBlock = banner.slice(banner.indexOf('accessibilityRole="alert"'));

    expect(banner).not.toMatch(/accessibilityLabel=\{isOffline \? 'You are offline' : ''\}/);
    expect(alertBlock).toMatch(/accessibilityLabel="You are offline"/);
  });

  /**
   * How this was found, and it is the more useful half. `audit:offline` grew a
   * recovery phase that looked for the element and found it on a working build
   * — reporting an app that was fine as offline. The same string had been
   * turning up in every browser probe in this repository for weeks, reading
   * like a defect that was not there.
   */
  it('is checked by height rather than by presence, now that presence proved nothing', () => {
    const audit = code('scripts/audit-offline.mjs');

    expect(audit).toMatch(/getBoundingClientRect\(\)\.height > 1/);
  });
});

/**
 * 3 — a connection that comes back, which the app never noticed.
 *
 * NetInfo's web layer binds to `navigator.connection`'s `change` event wherever
 * that API exists — every Chromium browser — and never to `online`/`offline`.
 * Recorded in Chromium across a drop and a recovery: one `change` going down,
 * none coming back.
 */
describe('coming back online in a browser', () => {
  it('is carried by the browser’s own events rather than NetInfo’s', () => {
    const source = code('src/features/system/useNetworkStatus.ts');

    expect(source).toMatch(/window\.addEventListener\('online', publish\)/);
    expect(source).toMatch(/window\.addEventListener\('offline', publish\)/);
  });

  /** 4 — and so are the paused queries, which is the half that costs data. */
  it('is what tells TanStack Query to resume, too', () => {
    const source = code('src/features/system/useNetworkStatus.ts');
    const manager = source.slice(source.indexOf('onlineManager.setEventListener'));

    expect(manager).toMatch(/window\.addEventListener\('online', republish\)/);
    expect(manager).toMatch(/window\.addEventListener\('offline', republish\)/);
  });

  it('is driven end to end by the offline audit', () => {
    const audit = code('scripts/audit-offline.mjs');

    expect(audit).toMatch(/setOffline\(true\)/);
    expect(audit).toMatch(/setOffline\(false\)/);
    expect(audit).toMatch(/the banner clears on its own when it comes back/);
    expect(audit).toMatch(/the menu is still there afterwards/);
  });

  /**
   * The audit needs two builds because it asks two questions that need opposite
   * worlds: a dead API host to check what screens *say* when they cannot fetch,
   * and a working mock to check that connectivity itself recovers.
   */
  it('needs a second build with the mock on, and takes one', () => {
    const audit = code('scripts/audit-offline.mjs');

    expect(audit).toMatch(/EXPO_PUBLIC_USE_MOCK_API: '1'/);
    expect(audit).toMatch(/EXPO_PUBLIC_USE_MOCK_API: '0'/);
  });
});

/**
 * 5 — connectivity and reachability, which are not the same question.
 *
 * The first version of the fix replaced both with `navigator.onLine`, and
 * `audit:offline` failed on all eleven routes immediately: with the mock off
 * and a host that does not answer, the browser is online, so every screen went
 * back to "something went wrong" instead of naming the connection. Reachability
 * was the half carrying that, and it had never been broken.
 */
describe('the two halves of being offline', () => {
  it('treats a mock build as offline only when there is no network', () => {
    // `toStatus` is the shared decision; the seeded build runs with the mock on.
    expect(config.useMockApi).toBe(true);
    expect(toStatus(netInfo({ isConnected: true, isInternetReachable: false })).isOffline).toBe(
      false,
    );
    expect(toStatus(netInfo({ isConnected: false })).isOffline).toBe(true);
  });

  it('keeps reachability in the reading rather than discarding it', () => {
    const source = code('src/features/system/useNetworkStatus.ts');
    const overlay = source.slice(source.indexOf('function withBrowserConnectivity'));

    // The browser answers connectivity; NetInfo still answers reachability.
    expect(overlay).toMatch(/const isConnected = browserIsOnline\(\);/);
    expect(overlay).toMatch(/isConnected \? base\.isInternetReachable : false/);
  });

  it('reports nothing reachable once the network has gone', () => {
    const source = code('src/features/system/useNetworkStatus.ts');

    expect(source).toMatch(/type: isConnected \? base\.type : 'none'/);
  });
});

/**
 * 6 — a document that will not answer, and a platform that is not web.
 *
 * Both are states the code has to hold and neither had an example. A sandboxed
 * or server-rendered document has no `navigator`; a handset has NetInfo talking
 * to the OS, which is the right answer and must not be overridden.
 */
describe('the platforms this does not apply to', () => {
  it('assumes online when there is no navigator to ask', () => {
    const source = code('src/features/system/useNetworkStatus.ts');

    expect(source).toMatch(/typeof navigator === 'undefined' \? true/);
  });

  it('leaves native entirely alone', () => {
    const source = code('src/features/system/useNetworkStatus.ts');

    expect(source).toMatch(/const WEB = Platform\.OS === 'web' && typeof window !== 'undefined'/);
    expect(source).toMatch(/if \(!WEB\) return base;/);
  });

  it('still subscribes to NetInfo on every platform', () => {
    const source = code('src/features/system/useNetworkStatus.ts');

    // Reachability comes from NetInfo everywhere; only connectivity is layered.
    expect(source).toMatch(/NetInfo\.addEventListener\(apply\)/);
  });
});

/**
 * 7 — the bar at an enlarged text size.
 *
 * `onMeasure` has a note saying "a rotation or a font-scale change can
 * re-measure while the bar is already open", and until the web build honoured
 * the browser's text size there was no way for a font-scale change to happen in
 * a browser at all. Now there is, and the bar has to hold up.
 */
describe('the offline bar at enlarged text', () => {
  it('re-measures rather than stranding itself at the old height', () => {
    const banner = code('src/components/system/OfflineBanner.tsx');

    expect(banner).toMatch(/if \(isOffline\) height\.setValue\(next\)/);
  });

  /**
   * The first drop cannot animate from a measured height, because with nothing
   * mounted there is nothing measured. It snaps instead — which is the right
   * way round for the moment somebody loses signal.
   */
  it('accepts a snap on the very first drop, and says so', () => {
    const banner = readFileSync(
      path.join(__dirname, '..', 'src/components/system/OfflineBanner.tsx'),
      'utf8',
    );

    expect(banner).toMatch(/snaps the height rather than sliding/);
  });
});

/**
 * 8 — what the launch list is now entitled to say.
 *
 * A list that asks for work already done is a list people stop reading. The
 * note has to name the half that is settled and the half that still needs a
 * handset, rather than the whole thing.
 */
describe('the launch note on offline recovery', () => {
  it('points at the audit instead of asking for a device outright', () => {
    const audit = code('scripts/audit-launch-readiness.mjs');

    expect(audit).toMatch(/npm run audit:offline/);
    expect(audit).not.toMatch(/could not be shown to detect regaining it/);
  });

  /** 9 — and is honest that native takes a different path entirely. */
  it('says plainly that the handset path is untested here', () => {
    const audit = code('scripts/audit-launch-readiness.mjs');

    expect(audit).toMatch(/takes connectivity from the OS on iOS and Android/);
    expect(audit).toMatch(/that path is unchanged and untested here/);
  });
});

/**
 * 10 — the rule the whole subsystem exists to keep.
 *
 * "An empty state is a claim about the world, an error state is a claim about
 * the app." Eleven screens are held to it, and this is the guard that the guard
 * still runs — a sweep reporting green over an empty list is the failure mode
 * this file is least able to notice on its own.
 */
describe('the offline sweep itself', () => {
  it('checks a real list of screens', () => {
    const audit = code('scripts/audit-offline.mjs');
    const block = audit.slice(audit.indexOf('const ROUTES = ['), audit.indexOf('];'));
    const routes = block.match(/'\/[^']*'/g) ?? [];

    expect(routes.length).toBeGreaterThanOrEqual(10);
  });

  it('still states the rule it is enforcing', () => {
    expect(code('scripts/audit-offline.mjs')).toMatch(/An empty state is a claim about the world/);
  });
});
