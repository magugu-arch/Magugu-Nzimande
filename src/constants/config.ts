import Constants from 'expo-constants';

/**
 * Centralised runtime configuration.
 *
 * Every EXPO_PUBLIC_* var is read as a literal `process.env.NAME` expression.
 * That is not a style choice: Expo's babel plugin inlines these at build time
 * by static analysis, so a dynamic `process.env[key]` lookup would compile to
 * `undefined` on device. app.json `extra` provides the fallback.
 *
 * No secret ever lives here — only publishable values that are safe in a
 * client bundle.
 */

function str(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value === '') return fallback;
  return value === '1' || value.toLowerCase() === 'true';
}

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string };

export const config = {
  apiBaseUrl: str(
    process.env.EXPO_PUBLIC_API_BASE_URL,
    extra.apiBaseUrl ?? 'https://api.pappasrestaurant.co.za',
  ),
  apiTimeoutMs: num(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 15_000),
  /**
   * Which customer the mock layer pretends to be.
   *
   * `full` is the seeded regular: saved cards, saved addresses, an order
   * history, vouchers in the wallet. Convenient, and it has now hidden three
   * separate defects — a store list where every branch was open, a payment
   * list where five rails always arrived together, a menu that always
   * answered. Each looked fine because the seed was kinder than the world.
   *
   * `new-customer` is the person who installs the app on opening morning:
   * nothing saved, nothing ordered, nothing earned. That is every customer
   * Pappas gains at launch, and it was the one account nobody could test as.
   *
   * Read only through the mock layer, so it cannot affect a real build — and
   * `audit:launch` fails production if the mock is on at all.
   */
  seedProfile:
    str(process.env.EXPO_PUBLIC_SEED_PROFILE, 'full') === 'new-customer'
      ? ('new-customer' as const)
      : ('full' as const),
  /**
   * The mock layer, which makes the app fully explorable before the backend
   * exists. On in development; off in any release build unless something asks
   * for it by name.
   *
   * The default used to be plain `true`, which meant a release build that
   * forgot `EXPO_PUBLIC_USE_MOCK_API` would ship to a store quoting invented
   * prices and accepting orders no kitchen would ever see — silently, because
   * a fake backend never errors. Defaulting to `__DEV__` inverts that: the
   * worst a missing variable can now do is show error states against a
   * backend that is not there yet, which is loud and obviously wrong.
   *
   * Every profile in eas.json still sets the value explicitly, so nothing
   * about the intended builds changes. This only governs the case nobody
   * intended.
   */
  useMockApi: bool(process.env.EXPO_PUBLIC_USE_MOCK_API, __DEV__),

  /**
   * Illustrative menu prices, for demonstrating the ordering journey.
   *
   * §15 forbids inventing menu prices, so the catalogue ships every dish
   * unpriced and `available: false`. That is the correct production state and
   * it stays the default — but it also means nothing downstream of the cart
   * can be exercised, because an unavailable dish cannot enter one.
   *
   * Setting this fills in round placeholder prices from
   * `data/demoPrices.ts`, which unblocks checkout, loyalty, order placement
   * and tracking for the browser journeys and for a walkthrough.
   *
   * **Off unless asked for, and never in production.** `audit:launch
   * --production` fails the build when it is on, exactly as it does for the
   * mock API, and the app shows a standing banner while it is on — a
   * screenshot of a demo build is otherwise indistinguishable from a real
   * one, and these numbers would be quoted back at Pappas as though they were
   * the menu.
   */
  useDemoPrices: bool(process.env.EXPO_PUBLIC_DEMO_PRICES, false),

  maps: {
    provider: str(process.env.EXPO_PUBLIC_MAPS_PROVIDER, 'google'),
    apiKey: str(process.env.EXPO_PUBLIC_MAPS_API_KEY, ''),
  },

  payments: {
    provider: str(process.env.EXPO_PUBLIC_PAYMENT_PROVIDER, 'peach'),
    publicKey: str(process.env.EXPO_PUBLIC_PAYMENT_PUBLIC_KEY, ''),
  },

  push: {
    projectId: str(process.env.EXPO_PUBLIC_PUSH_PROJECT_ID, ''),
  },

  /**
   * Delivery-channel feature flags — Uber Eats + Mr D extension §5.
   *
   * Three independent switches, exactly as the brief specifies, so a channel
   * can be turned on the day its contract is signed without a code change and
   * without disturbing the other two. §11's acceptance criteria require both
   * that Pappas Direct works independently of the external providers and that
   * Uber Eats and Mr D can be enabled independently of each other; two
   * separate flags is what makes the second one true.
   *
   * Defaults are off for the external channels because no contract exists
   * yet. A flag that defaults on is a flag that ships a broken checkout the
   * first time somebody forgets to set it.
   *
   * These are *publishable* values: they say which channels the app should
   * offer, not how to talk to them. Every credential, token and signing
   * secret stays server-side — extension §1 and §8, and §11's acceptance
   * criterion "No provider secret is shipped to the client". There is
   * deliberately no `UBER_EATS_API_KEY` here, and there must never be one:
   * anything in `EXPO_PUBLIC_*` is readable in the shipped bundle by anyone
   * who downloads the app.
   */
  channels: {
    pappasDirectEnabled: bool(process.env.EXPO_PUBLIC_PAPPAS_DIRECT_ENABLED, true),
    uberEatsEnabled: bool(process.env.EXPO_PUBLIC_UBER_EATS_ENABLED, false),
    mrDEnabled: bool(process.env.EXPO_PUBLIC_MR_D_ENABLED, false),
    /**
     * Where the Pappas server exposes the provider-facing endpoints —
     * quoting, order creation and the webhook receiver. The adapters call
     * *this*, never a provider API directly, which is what keeps the
     * credentials off the device.
     */
    brokerBaseUrl: str(process.env.EXPO_PUBLIC_CHANNEL_BROKER_URL, ''),
  },
} as const;

/** Commercial rules kept out of screen code (brief §3 architecture rule). */
export const businessRules = {
  currency: 'ZAR',
  currencySymbol: 'R',
  locale: 'en-ZA',
  /** Orders under this subtotal are blocked at checkout for delivery. */
  minimumDeliverySubtotal: 100,
  /** Standard delivery fee, waived above the threshold below. */
  deliveryFee: 32,
  freeDeliveryThreshold: 350,
  /** Flat service fee applied to every paid order. */
  serviceFee: 5,
  /** Loyalty points earned per rand spent. */
  pointsPerRand: 1,
  /** Rand value of one loyalty point when redeemed. */
  randPerPoint: 0.05,
  maxQuantityPerLine: 20,
  /** How far ahead an order may be scheduled. */
  maxScheduleDays: 5,
  /** Earliest scheduling offset from now, in minutes. */
  minScheduleLeadMinutes: 45,
  defaultPreparationMinutes: 18,
  deliveryBufferMinutes: 20,
} as const;

/**
 * Support contact.
 *
 * Moved to `data/pappasContent.ts`, where each channel is a `Fact` that is
 * either verified or explicitly awaiting business input. It cannot live here
 * as a string constant any more: a phone number and a set of trading hours
 * are exactly the kind of thing §15 forbids inventing, and a constant has
 * nowhere to record that nobody has supplied one.
 *
 * Re-exported so the existing import path keeps working.
 */
export { SUPPORT } from '@/data/pappasContent';
