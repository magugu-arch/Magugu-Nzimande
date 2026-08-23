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
    extra.apiBaseUrl ?? 'https://api.bbqchicken.co.za',
  ),
  apiTimeoutMs: num(process.env.EXPO_PUBLIC_API_TIMEOUT_MS, 15_000),
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

export const SUPPORT = {
  phone: '0860 022 700',
  email: 'support@bbqchicken.co.za',
  whatsapp: '+27 60 000 0000',
  hours: 'Every day, 10:00 – 22:00',
} as const;
