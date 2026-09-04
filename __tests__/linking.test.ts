import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { Linking, Platform } from 'react-native';
import { useDialogStore } from '@/ux/dialog';
import {
  callNumber,
  directionsUrl,
  inAppRoute,
  isDiallable,
  openExternal,
  telUrl,
} from '@/utils/linking';

describe('telUrl', () => {
  /**
   * The bug this closes: the order screen dialled
   * `tel:bb.q Chicken Rosebank`. The number was never on the order — only the
   * name was — and interpolating it at the call site hid that.
   */
  it('strips the spaces South African numbers are written with', () => {
    expect(telUrl('011 883 0100')).toBe('tel:0118830100');
  });

  it('keeps a leading plus, because international numbers need it', () => {
    expect(telUrl('+27 11 883 0100')).toBe('tel:+27118830100');
  });

  it('drops the brackets and dashes people paste in', () => {
    expect(telUrl('(011) 883-0100')).toBe('tel:0118830100');
  });

  it('produces digits and nothing else', () => {
    // The property that actually matters: whatever went in, what comes out is
    // something a dialler will accept.
    expect(telUrl(' 021 418 9900 ')).toMatch(/^tel:\+?\d+$/);
  });
});

describe('isDiallable', () => {
  it('accepts a real number', () => {
    expect(isDiallable('011 447 2200')).toBe(true);
  });

  it.each([
    ['a store name', 'bb.q Chicken Rosebank'],
    ['an empty string', ''],
    ['too few digits', '0114'],
    ['nothing at all', undefined],
  ])('refuses %s', (_label, value) => {
    expect(isDiallable(value)).toBe(false);
  });
});

describe('directionsUrl', () => {
  const target = { latitude: -26.1465, longitude: 28.0436, label: 'bb.q Chicken Rosebank' };

  afterEach(() => {
    Platform.OS = 'ios';
  });

  it('sends iOS to Apple Maps with the destination and a driving flag', () => {
    Platform.OS = 'ios';
    const url = directionsUrl(target);

    expect(url).toContain('maps.apple.com');
    expect(url).toContain('daddr=-26.1465,28.0436');
    expect(url).toContain('dirflg=d');
  });

  it('sends Android to a geo: link so the customer keeps their maps app', () => {
    Platform.OS = 'android';
    expect(directionsUrl(target)).toBe(
      'geo:-26.1465,28.0436?q=-26.1465,28.0436(bb.q%20Chicken%20Rosebank)',
    );
  });

  it('escapes the store name, which contains spaces and a full stop', () => {
    Platform.OS = 'ios';
    // An unescaped space truncates the query at the first word on some
    // handlers, which would open a pin labelled "bb.q".
    expect(directionsUrl(target)).not.toMatch(/q=[^&]*\s/);
  });

  it('falls back to a web maps link off-device', () => {
    Platform.OS = 'web';
    expect(directionsUrl(target)).toContain('google.com/maps/dir/');
  });
});

/**
 * These used to spy on `Alert.alert` and assert it had been called. That
 * proved the app *intended* to say something — which on the web build was all
 * it ever did, because react-native-web's `Alert.alert` is an empty function.
 * The notice now goes through `ux/dialog`, so what is asserted is the request
 * a customer would actually be shown. See `__tests__/dialog.test.tsx`.
 */
const notices = () => useDialogStore.getState().queue;

describe('openExternal', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    useDialogStore.getState().reset();
  });

  it('opens the URL and reports success', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);

    await expect(openExternal('tel:0118830100')).resolves.toBe(true);
    expect(openURL).toHaveBeenCalledWith('tel:0118830100');
    expect(notices()).toHaveLength(0);
  });

  /**
   * Every one of these handoffs used to be `void Linking.openURL(...)`. On a
   * device with no dialler that rejects, the `void` swallows it, and the tap
   * does nothing with no explanation.
   */
  it('says something when the handoff fails instead of failing silently', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));

    await expect(openExternal('tel:0118830100')).resolves.toBe(false);
    expect(notices()).toHaveLength(1);
    expect(notices()[0]?.title).toBe('Could not open that');
  });

  it('puts the number in the failure message, so the call is still possible', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));

    await callNumber('011 883 0100');

    expect(notices()[0]?.message).toContain('011 883 0100');
  });

  /**
   * And resolves without waiting for the notice to be dismissed. `tell` is
   * deliberately not awaited here: this function reports whether the handoff
   * succeeded, not whether the customer has read about it — so an undismissed
   * notice must never hold up its answer.
   */
  it('never rejects, so no caller needs a catch of its own', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no handler'));

    // `void openExternal(...)` is the call shape used throughout the app; an
    // unhandled rejection there is a red box in development.
    await expect(openExternal('mailto:hello@example.com')).resolves.toBe(false);
    // Still unanswered — nothing has dismissed it — and the call returned anyway.
    expect(notices()).toHaveLength(1);
  });
});

/**
 * Two places take a path from server data and push it as a route: a push
 * notification's `data.href` and a promotion's `ctaHref`. They had different
 * guards and both were wrong — one checked `startsWith('/')`, which
 * "//evil.example/phish" satisfies; the other had no guard at all.
 */
describe('following a route somebody else chose', () => {
  const FALLBACK = '/(tabs)/menu';

  it('follows an ordinary in-app path', () => {
    expect(inAppRoute('/order/order-4821', FALLBACK)).toBe('/order/order-4821');
    expect(inAppRoute('/offers?from=push', FALLBACK)).toBe('/offers?from=push');
  });

  it.each([
    ['https://evil.example/phish', 'an absolute URL'],
    ['//evil.example/phish', 'a protocol-relative URL that starts with a slash'],
    ['///evil.example', 'three slashes'],
    ['/\\evil.example', 'a backslash some parsers fold into a slash'],
    ['/javascript:alert(1)', 'a scheme wearing a path as clothes'],
    ['javascript:alert(1)', 'a bare scheme'],
    ['', 'nothing at all'],
    ['offers', 'a relative path, which is not ours to resolve'],
  ])('refuses %p — %s', (href) => {
    expect(inAppRoute(href, FALLBACK)).toBe(FALLBACK);
  });

  it('refuses anything that is not a string', () => {
    expect(inAppRoute(undefined, FALLBACK)).toBe(FALLBACK);
    expect(inAppRoute(null, FALLBACK)).toBe(FALLBACK);
    expect(inAppRoute(42, FALLBACK)).toBe(FALLBACK);
    expect(inAppRoute({ href: '/offers' }, FALLBACK)).toBe(FALLBACK);
  });

  /** A promotion with a broken link should still open a screen. */
  it('hands back the fallback rather than throwing', () => {
    expect(() => inAppRoute('https://evil.example', FALLBACK)).not.toThrow();
  });
});

/**
 * The label was already encoded and the coordinates were not, which is the
 * same hole in the same URL. They come off a store record fetched from the
 * API, and `request<T>` casts rather than validates — nothing between the
 * JSON and here would notice a string arriving where a number is declared.
 */
describe('building a directions link out of API data', () => {
  it('encodes a label that carries URL punctuation', () => {
    const url = directionsUrl({
      latitude: -26.1,
      longitude: 28.05,
      label: 'bb.q Sandton & Co?a=b',
    });
    expect(url).not.toContain('&a=b');
    expect(url).toContain(encodeURIComponent('bb.q Sandton & Co?a=b'));
  });

  it('coerces coordinates rather than interpolating whatever arrived', () => {
    const url = directionsUrl({
      latitude: '-26.1&daddr=evil' as unknown as number,
      longitude: 28.05,
      label: 'bb.q',
    });
    expect(url).not.toContain('daddr=evil');
    expect(url).toContain('NaN');
  });

  it('still builds an ordinary link', () => {
    const url = directionsUrl({ latitude: -26.1446, longitude: 28.0424, label: 'bb.q Rosebank' });
    expect(url).toContain('-26.1446,28.0424');
  });
});

/**
 * Nobody builds one of these by hand again.
 *
 * `utils/linking` exists because call sites were interpolating URLs inline —
 * the order screen once dialled `tel:bb.q Chicken Rosebank`. Three screens
 * were converted to `callNumber`; one was missed, and it was the worst of the
 * three: the "Call the store" button that appears only after a payment whose
 * outcome is unknown, where the phone is the way out rather than the button.
 * A raw `tel:011 883 0100` keeps the spaces some diallers reject, and the
 * `void` in front of it discarded the rejection, so the tap did nothing and
 * said nothing.
 *
 * A grep is the right shape of test for this. The defect was not that any one
 * screen was wrong; it was that the rule lived in a helper nothing obliged
 * anyone to use.
 */
describe('no screen builds a dial or maps URL by hand', () => {
  const sources = () => {
    const roots = [path.join(__dirname, '..', 'src')];
    const files: string[] = [];
    while (roots.length > 0) {
      const dir = roots.pop()!;
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) roots.push(full);
        else if (/\.tsx?$/.test(entry.name) && !full.includes('utils/linking')) files.push(full);
      }
    }
    return files;
  };

  /**
   * Comments removed first. The first version of this failed on the very file
   * it had just been written to clear, because the comment there quotes the
   * old `tel:${store.phone}` to explain what it replaced. A guard that cannot
   * tell code from prose about code teaches people to delete the prose.
   */
  const code = (file: string) =>
    readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  const offending = (pattern: RegExp) =>
    sources()
      .filter((file) => pattern.test(code(file)))
      .map((file) => path.relative(path.join(__dirname, '..'), file));

  it('routes every tel: through telUrl', () => {
    expect(offending(/['"`]tel:/)).toEqual([]);
  });

  it('routes every maps handoff through openDirections', () => {
    expect(offending(/['"`](https:\/\/maps\.|maps:|geo:)/)).toEqual([]);
  });

  /**
   * The guard has to be able to fail, or it is decoration. This is the shape
   * the checkout screen was in until it was found.
   */
  it('would catch a call site that built one by hand', () => {
    const raw = 'onPress={() => void Linking.openURL(`tel:${store.phone}`)}';
    expect(/['"`]tel:/.test(raw)).toBe(true);
  });
});
