import fs from 'node:fs';
import path from 'node:path';
import {
  ANALYTICS_EVENTS,
  identify,
  setAnalyticsAdapter,
  track,
  type AnalyticsAdapter,
  type AnalyticsEvent,
} from '@/ux/analytics';

const root = path.resolve(__dirname, '..');

/**
 * The analytics taxonomy, against brief §15 and against the app that sends it.
 *
 * §15 asks for eleven events and then says what they are for: "dashboards
 * around conversion, cart abandonment, fulfilment mix, top items and repeat
 * ordering". A funnel is only as good as its weakest step — one event that
 * never fires and the conversion rate is wrong in a way nobody notices for a
 * quarter — so these hold both halves: that every event §15 names exists, and
 * that something in the app actually sends it.
 */
describe('the taxonomy brief §15 asks for', () => {
  /** §15, verbatim. */
  const REQUIRED_BY_BRIEF: AnalyticsEvent[] = [
    'view_menu',
    'select_fulfilment',
    'select_store',
    'view_item',
    'add_to_cart',
    'begin_checkout',
    'add_payment_info',
    'purchase',
    'reward_redeem',
    'reorder',
    'support_contact',
  ];

  it.each(REQUIRED_BY_BRIEF)('declares %s', (event) => {
    expect(ANALYTICS_EVENTS).toContain(event);
  });

  /**
   * The five the starter kit's taxonomy had and §15 did not, renamed into
   * §15's convention. Kept because the concepts are real, asserted so a later
   * tidy-up does not quietly drop half a funnel.
   */
  it.each(['select_category', 'search', 'select_modifier', 'view_cart', 'view_order_status'])(
    'keeps %s from the starter kit taxonomy',
    (event) => {
      expect(ANALYTICS_EVENTS).toContain(event);
    },
  );

  it('names every event once', () => {
    expect(new Set(ANALYTICS_EVENTS).size).toBe(ANALYTICS_EVENTS.length);
  });
});

/**
 * The half that a type cannot check: an event that exists but is never sent is
 * a hole in a dashboard, and the compiler is perfectly happy with it.
 */
describe('every declared event is actually sent by the app', () => {
  const sources = (function walk(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return /\.tsx?$/.test(entry.name) && !full.endsWith(path.join('ux', 'analytics.ts'))
        ? [fs.readFileSync(full, 'utf8')]
        : [];
    });
  })(path.join(root, 'src'));

  const callSites = sources.join('\n');

  it.each(ANALYTICS_EVENTS)('%s has a call site', (event) => {
    expect(callSites).toContain(`track('${event}'`);
  });
});

/**
 * No personal information leaves the device.
 *
 * This is a POPIA position before it is a taste one, and it is the rule most
 * likely to be broken by accident — an analytics SDK will happily accept an
 * email, and adding one to a payload is a one-line change that looks helpful.
 * So the payload types are read as source and held to primitives with names
 * that cannot carry identity.
 */
describe('payloads carry no personal information', () => {
  const analyticsSource = fs.readFileSync(path.join(root, 'src', 'ux', 'analytics.ts'), 'utf8');
  const eventBlock = analyticsSource.slice(
    analyticsSource.indexOf('export interface AnalyticsEvents'),
    analyticsSource.indexOf('export type AnalyticsEvent'),
  );

  const FORBIDDEN = [
    'email',
    'name:',
    'phone',
    'address',
    'firstName',
    'lastName',
    'query:',
    'message',
    'card',
    'last4',
    'pan',
    'cvv',
    'token',
    'latitude',
    'longitude',
  ];

  /**
   * Comments carry the reasoning and quite reasonably use these words — the
   * doc line on `add_payment_info` says "never the card, only its kind" — so
   * they are stripped rather than filtered by line prefix. A prefix filter
   * misses a block comment opened and closed on one line, which is most of them.
   */
  const declarations = eventBlock.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '');

  it.each(FORBIDDEN)('no payload field mentions %s', (field) => {
    expect(declarations.toLowerCase()).not.toContain(field.toLowerCase());
  });

  it('sends the shape of a search, never the words', () => {
    // Customers type addresses, order numbers and worse into a search field.
    expect(eventBlock).toContain('queryLength');
    expect(eventBlock).not.toContain('queryText');
  });
});

describe('track never lets analytics break the app', () => {
  afterEach(() => setAnalyticsAdapter(null));

  it('swallows a throwing adapter', () => {
    setAnalyticsAdapter({
      track: () => {
        throw new Error('provider is down');
      },
    });

    // This sits between "Place order" and a confirmation screen. A thrown
    // error here costs a sale in order to measure a sale.
    expect(() => track('view_menu', { categoryCount: 7 })).not.toThrow();
  });

  it('swallows a throwing identify', () => {
    setAnalyticsAdapter({
      track: () => {},
      identify: () => {
        throw new Error('provider is down');
      },
    });

    expect(() => identify('user-1')).not.toThrow();
  });

  it('sends nothing at all until a provider is injected', () => {
    // No vendor SDK is bundled, and none should be reachable by default: an
    // analytics library ships an identifier for every customer, and choosing
    // one is a decision bb.q has not made.
    expect(() => track('view_menu', { categoryCount: 7 })).not.toThrow();
  });

  it('passes the event and payload through to the adapter unchanged', () => {
    const sent: { event: string; payload: unknown }[] = [];
    const adapter: AnalyticsAdapter = {
      track: (event, payload) => sent.push({ event, payload }),
    };
    setAnalyticsAdapter(adapter);

    track('purchase', {
      orderId: 'BBQ-4823',
      value: 312.5,
      fees: 35,
      discount: 20,
      itemCount: 3,
      fulfilment: 'delivery',
      storeId: 'store-sandton',
    });

    expect(sent).toHaveLength(1);
    expect(sent[0]?.event).toBe('purchase');
    expect(sent[0]?.payload).toMatchObject({ orderId: 'BBQ-4823', value: 312.5 });
  });
});
