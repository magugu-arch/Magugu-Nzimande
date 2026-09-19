/**
 * The provider registry — extension §5.
 *
 * One place that knows which channels exist, which are switched on, and what
 * each can do. Screens ask this; they never construct an adapter, and they
 * never read a feature flag directly. That matters because the answer to
 * "can the customer use Uber Eats right now" is three separate facts —
 * the flag, the credentials, and the capability for the mode being asked
 * for — and a screen that checks one of them ships a dead button.
 *
 * The brief's §5 sketch is a bare object literal and a `getProvider` that
 * throws on an unknown id. Both are kept. What is added is the availability
 * query, because the sketch has no answer to the question every screen
 * actually asks, and §5's own UI rule — "Disabled/unconfigured provider =>
 * 'Coming soon' / 'Currently unavailable'" — cannot be followed without one.
 */

import { config } from '../../constants/config';
import { capabilityForMode } from './fulfilment';
import { MrDAdapter } from './providers/MrDAdapter';
import { PappasDirectAdapter, type PappasDirectDeps } from './providers/PappasDirectAdapter';
import { UberEatsAdapter } from './providers/UberEatsAdapter';
import {
  PROVIDER_IDS,
  type DeliveryProvider,
  type FulfilmentMode,
  type ProviderAvailability,
  type ProviderId,
} from './types';

/**
 * The store lookup Pappas Direct needs.
 *
 * Injected at registry construction so this module has no import edge into
 * the service layer — which keeps the whole integration tree testable without
 * a running app, and stops a circular import between orders and channels.
 */
let directDeps: PappasDirectDeps = {
  async getStore() {
    return null;
  },
};

/**
 * Wire the registry to the app's store service.
 *
 * Called once during app start-up. Left unwired, Pappas Direct quotes fail
 * with a clear `PROVIDER_ERROR` rather than silently pretending a store
 * exists.
 */
export function configureDirectChannel(deps: PappasDirectDeps): void {
  directDeps = deps;
  providers = null;
}

let providers: Record<ProviderId, DeliveryProvider> | null = null;

function all(): Record<ProviderId, DeliveryProvider> {
  if (!providers) {
    providers = {
      'pappas-direct': new PappasDirectAdapter({
        // Read through the closure rather than capturing `directDeps` by
        // value, so a late `configureDirectChannel` is still seen.
        getStore: (storeId) => directDeps.getStore(storeId),
      }),
      'uber-eats': new UberEatsAdapter(),
      'mr-d': new MrDAdapter(),
    };
  }
  return providers;
}

/** Brief §5, unchanged: unknown ids are a programming error, not a state. */
export function getProvider(id: ProviderId): DeliveryProvider {
  const provider = all()[id];
  if (!provider) throw new Error(`UNKNOWN_PROVIDER:${id}`);
  return provider;
}

/** Whether a channel's feature flag is on. Flags only — not readiness. */
export function isChannelEnabled(id: ProviderId): boolean {
  switch (id) {
    case 'pappas-direct':
      return config.channels.pappasDirectEnabled;
    case 'uber-eats':
      return config.channels.uberEatsEnabled;
    case 'mr-d':
      return config.channels.mrDEnabled;
  }
}

/**
 * How one channel should be presented for a given fulfilment mode.
 *
 * The three facts, resolved in the order that produces the most useful words
 * on screen:
 *
 *   1. Flag off            → "coming soon". Pappas has not switched it on.
 *   2. Cannot do this mode → "unavailable" with `UNSUPPORTED_MODE`. The
 *      channel is live but cannot collect, so offering it under a Collection
 *      toggle would be a dead end.
 *   3. External and unconfigured → "coming soon". No credentials yet.
 *
 * Nothing here calls a provider API, so it is safe to run on render.
 */
export async function availabilityFor(
  id: ProviderId,
  mode: FulfilmentMode,
): Promise<ProviderAvailability> {
  const provider = getProvider(id);
  const capabilities = await provider.getCapabilities();
  const base = { provider: id, displayName: provider.displayName, capabilities };

  if (!isChannelEnabled(id)) {
    return { ...base, state: 'coming-soon', reason: 'DISABLED' };
  }

  if (!capabilities.includes(capabilityForMode(mode))) {
    return { ...base, state: 'unavailable', reason: 'UNSUPPORTED_MODE' };
  }

  // An external channel with no broker configured is announced rather than
  // hidden: extension §5's UI rule, and it is also the honest marketing
  // position — these partnerships are planned, not live.
  if (id !== 'pappas-direct' && config.channels.brokerBaseUrl.length === 0) {
    return { ...base, state: 'coming-soon', reason: 'NOT_CONFIGURED' };
  }

  return { ...base, state: 'available' };
}

/**
 * Every channel, in display order, for a given fulfilment mode.
 *
 * Returns all three whatever their state — a "coming soon" row is content,
 * not an error, and hiding disabled partners would make the channel picker
 * change shape as flags flip, which is worse than a quiet row.
 */
export async function listAvailability(
  mode: FulfilmentMode,
): Promise<ProviderAvailability[]> {
  return Promise.all(PROVIDER_IDS.map((id) => availabilityFor(id, mode)));
}

/**
 * The channel the app should default to.
 *
 * Pappas Direct whenever it can serve the mode. This is a commercial
 * position as much as a technical one: extension §7 notes that loyalty
 * points apply to direct orders and generally cannot be attributed on
 * external ones, so the default channel is the one where the customer earns
 * and Pappas owns the relationship. Falling back to the first genuinely
 * available channel keeps the app usable if Direct is ever switched off.
 */
export async function defaultProviderFor(
  mode: FulfilmentMode,
): Promise<ProviderId | null> {
  const states = await listAvailability(mode);
  const direct = states.find((s) => s.provider === 'pappas-direct');
  if (direct?.state === 'available') return 'pappas-direct';
  return states.find((s) => s.state === 'available')?.provider ?? null;
}

/** Test seam: drop memoised adapters so a flag change is observed. */
export function resetProviderRegistry(): void {
  providers = null;
}
