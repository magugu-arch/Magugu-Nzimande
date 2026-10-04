/**
 * Runtime configuration — every variable is documented in docs/ENVIRONMENT.md.
 *
 * Expo inlines `process.env.EXPO_PUBLIC_*` at build time, and only when the
 * property is read by its literal name, so each one is spelled out below
 * rather than looked up dynamically.
 */

export type DataMode = 'mock' | 'live';
export type ClockMode = 'scenario' | 'live';

export const MOCK_DOMAINS = [
  'auth',
  'academic',
  'learning',
  'finance',
  'library',
  'transport',
  'residence',
  'commerce',
  'community',
  'alumni',
  'notifications',
  'campus',
  'support',
  'guardian',
] as const;
export type AdapterDomain = (typeof MOCK_DOMAINS)[number];

export interface AppConfig {
  dataMode: DataMode;
  bffBaseUrl: string | null;
  oidc: { issuer: string | null; clientId: string | null };
  clock: ClockMode;
  mockLatencyMs: number;
  mockFailures: ReadonlySet<AdapterDomain>;
  orderReadySeconds: number;
  /** Signed-in sessions last this long before the user must re-authenticate. */
  sessionMinutes: number;
}

const blank = (v: string | undefined): string | null => (v && v.trim() ? v.trim() : null);

function intOr(v: string | undefined, fallback: number): number {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function readConfig(env: Record<string, string | undefined>): AppConfig {
  const failures = (env.EXPO_PUBLIC_MOCK_FAILURES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s): s is AdapterDomain => (MOCK_DOMAINS as readonly string[]).includes(s));

  return {
    dataMode: env.EXPO_PUBLIC_DATA_MODE === 'live' ? 'live' : 'mock',
    bffBaseUrl: blank(env.EXPO_PUBLIC_BFF_BASE_URL),
    oidc: {
      issuer: blank(env.EXPO_PUBLIC_OIDC_ISSUER),
      clientId: blank(env.EXPO_PUBLIC_OIDC_CLIENT_ID),
    },
    clock: env.EXPO_PUBLIC_DEMO_CLOCK === 'live' ? 'live' : 'scenario',
    mockLatencyMs: intOr(env.EXPO_PUBLIC_MOCK_LATENCY_MS, 350),
    mockFailures: new Set(failures),
    orderReadySeconds: intOr(env.EXPO_PUBLIC_MOCK_ORDER_READY_SECONDS, 20),
    sessionMinutes: 8 * 60,
  };
}

export const config: AppConfig = readConfig({
  EXPO_PUBLIC_DATA_MODE: process.env.EXPO_PUBLIC_DATA_MODE,
  EXPO_PUBLIC_BFF_BASE_URL: process.env.EXPO_PUBLIC_BFF_BASE_URL,
  EXPO_PUBLIC_OIDC_ISSUER: process.env.EXPO_PUBLIC_OIDC_ISSUER,
  EXPO_PUBLIC_OIDC_CLIENT_ID: process.env.EXPO_PUBLIC_OIDC_CLIENT_ID,
  EXPO_PUBLIC_DEMO_CLOCK: process.env.EXPO_PUBLIC_DEMO_CLOCK,
  EXPO_PUBLIC_MOCK_LATENCY_MS: process.env.EXPO_PUBLIC_MOCK_LATENCY_MS,
  EXPO_PUBLIC_MOCK_FAILURES: process.env.EXPO_PUBLIC_MOCK_FAILURES,
  EXPO_PUBLIC_MOCK_ORDER_READY_SECONDS: process.env.EXPO_PUBLIC_MOCK_ORDER_READY_SECONDS,
});
