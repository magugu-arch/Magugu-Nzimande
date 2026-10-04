import { config, type AdapterDomain } from '../config';
import type { ProviderContext } from './contracts';
import { AdapterError } from './errors';

/**
 * Shared state the adapters read: connectivity, and who they are acting for.
 *
 * Connectivity is pushed in from NetInfo by the app shell; adapters read it so
 * that a request made offline fails fast with `offline` instead of hanging —
 * which is what lets every screen show a real offline state (brief §25).
 */
let online = true;
let context: ProviderContext = { userId: null, role: null };
let latencyOverride: number | null = null;

export const connectivity = {
  isOnline: () => online,
  setOnline(value: boolean) {
    online = value;
  },
};

export const providerContext = {
  get: (): ProviderContext => context,
  set(next: ProviderContext) {
    context = next;
  },
};

export function setMockLatencyForTesting(ms: number | null): void {
  latencyOverride = ms;
}

const delay = (ms: number) =>
  ms > 0 ? new Promise<void>((resolve) => setTimeout(resolve, ms)) : Promise.resolve();

/** Deep copy so callers can never mutate mock state through a returned object. */
const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/**
 * Runs a mock operation the way a network call behaves: after a short delay,
 * failing when offline or when the domain is listed in
 * EXPO_PUBLIC_MOCK_FAILURES (to demonstrate error states on demand).
 */
export async function simulate<T>(
  domain: AdapterDomain,
  operation: () => T | Promise<T>,
  opts: { latencyMs?: number } = {},
): Promise<T> {
  await delay(latencyOverride ?? opts.latencyMs ?? config.mockLatencyMs);
  if (!online) throw new AdapterError('offline', domain, 'No connection');
  if (config.mockFailures.has(domain)) {
    throw new AdapterError('unavailable', domain, `${domain} service unavailable (simulated)`);
  }
  return clone(await operation());
}

/** Rejects unless a user is signed in — sensitive adapters call this first. */
export function requireUser(domain: AdapterDomain): string {
  if (!context.userId) throw new AdapterError('unauthorised', domain, 'Not signed in');
  return context.userId;
}
