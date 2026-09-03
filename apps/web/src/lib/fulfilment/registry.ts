import type { CourierAdapter, PosAdapter } from './adapters';
import { uberDirectAdapter } from './uber/provider';

/**
 * Which courier and which kitchen system this deployment is attached to.
 *
 * Both return null unless configured, and — unlike payments — null is not a
 * refusal. An order with no courier still stands and still reaches the console;
 * a store can drive it out itself. That difference is the whole design of the
 * fulfilment seam and is tested.
 */

export type FulfilmentEnv = {
  BBQ_COURIER_PROVIDER?: string | undefined;
  BBQ_UBER_CLIENT_ID?: string | undefined;
  BBQ_UBER_CLIENT_SECRET?: string | undefined;
  BBQ_UBER_CUSTOMER_ID?: string | undefined;
  BBQ_UBER_WEBHOOK_SECRET?: string | undefined;
  readonly [other: string]: string | undefined;
};

export function activeCourier(env: FulfilmentEnv = process.env): CourierAdapter | null {
  if (env.BBQ_COURIER_PROVIDER !== 'uber-direct') return null;

  const clientId = env.BBQ_UBER_CLIENT_ID;
  const clientSecret = env.BBQ_UBER_CLIENT_SECRET;
  const customerId = env.BBQ_UBER_CUSTOMER_ID;

  // All three. Two of them get a token that is refused, and one of them builds
  // a URL that is a 404 — both of which look like an outage rather than a
  // missing variable, which is the failure worth spending a check to avoid.
  if (!clientId || !clientSecret || !customerId) return null;

  return uberDirectAdapter({ clientId, clientSecret, customerId });
}

/**
 * The key Uber signs its webhooks with.
 *
 * Separate from the API credentials because Uber issues it separately, per
 * webhook, and because losing it has a different consequence: without it the
 * callback endpoint cannot verify anything and must refuse everything.
 */
export function courierWebhookSecret(env: FulfilmentEnv = process.env): string | null {
  const secret = env.BBQ_UBER_WEBHOOK_SECRET;
  return secret && secret.length > 0 ? secret : null;
}

/** No POS vendor has been named yet. The seam is here for when one is. */
export function activePos(): PosAdapter | null {
  return null;
}
