import { STORES } from '@bbq/seed';
import type { CourierAdapter, Handoff } from '../adapters';
import { dropoffAddress, e164, encodeAddress, pickupAddress } from './address';
import { accessToken, type Credentials } from './auth';

/**
 * Uber Direct.
 *
 * A note on the name, because it matters for what this is: Uber Eats is a
 * marketplace — customers order in Uber's app and Uber owns the relationship.
 * Uber Direct is the courier-as-a-service product underneath it, where the
 * customer orders here and an Uber driver delivers. A courier adapter for
 * orders placed on our own site is Uber Direct; an Uber Eats integration would
 * be an inbound order channel and a menu sync, which is different work.
 */

const API = 'https://api.uber.com';

export type UberConfig = Credentials & {
  /** Uber's id for the merchant organisation, in the delivery path. */
  customerId: string;
  fetcher?: typeof fetch;
};

type DeliveryResponse = { id?: unknown; status?: unknown; tracking_url?: unknown };

export function uberDirectAdapter(config: UberConfig): CourierAdapter {
  const send = config.fetcher ?? fetch;

  async function authorised(
    path: string,
    init: RequestInit & { idempotencyKey?: string },
  ): Promise<Response | null> {
    const token = await accessToken(config, send);
    if (!token) return null;

    const headers = new Headers(init.headers);
    headers.set('authorization', `Bearer ${token}`);
    headers.set('content-type', 'application/json');
    // Uber deduplicates on this. Without it a retried dispatch — a timeout that
    // actually succeeded, a worker restarted mid-request — sends a second
    // driver to the same address for the same food.
    if (init.idempotencyKey) headers.set('Idempotency-Key', init.idempotencyKey);

    try {
      return await send(`${API}${path}`, { ...init, headers });
    } catch {
      return null;
    }
  }

  return {
    name: 'uber-direct',

    async requestPickup(order): Promise<Handoff> {
      const store = STORES.find((candidate) => candidate.id === order.storeId);
      if (!store) {
        return { ok: false, error: `No such store: ${order.storeId}`, retryable: false };
      }

      const dropoff = dropoffAddress(order);
      if (!dropoff) {
        // Refused rather than sent half-formed. Uber would accept a partial
        // address and a driver would find out at the kerb.
        return {
          ok: false,
          error: 'The order has no street address and suburb to deliver to',
          retryable: false,
        };
      }

      const phone = e164(order.customer.mobile);
      if (!phone) {
        return { ok: false, error: 'The customer has no callable number', retryable: false };
      }

      const response = await authorised(`/v1/customers/${config.customerId}/deliveries`, {
        method: 'POST',
        idempotencyKey: order.id,
        body: JSON.stringify({
          pickup_name: store.name,
          pickup_address: encodeAddress(pickupAddress(store)),
          pickup_phone_number: e164(store.telephone) ?? store.telephone,
          dropoff_name: order.customer.name,
          dropoff_address: encodeAddress(dropoff),
          dropoff_phone_number: phone,
          dropoff_notes: order.kitchenNote || undefined,
          // Our own id, echoed back on every webhook. This is what ties a
          // delivery update to an order without a lookup table.
          external_id: order.id,
          manifest_items: order.lines.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            size: 'small',
          })),
          manifest_reference: order.orderNumber,
        }),
      });

      if (!response) {
        // No token, or the request never completed. Retryable: nothing here
        // says the delivery was not created, only that we did not hear.
        return { ok: false, error: 'Could not reach Uber', retryable: true };
      }

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        return {
          ok: false,
          error: `Uber refused the delivery (${response.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
          // 4xx is our request being wrong and will be wrong again; 5xx and 429
          // are worth another go.
          retryable: response.status >= 500 || response.status === 429,
        };
      }

      const body = (await response.json().catch(() => null)) as DeliveryResponse | null;
      const reference = typeof body?.id === 'string' ? body.id : null;
      if (!reference) {
        // Accepted, but we cannot say by what. Not retryable — retrying would
        // create a second delivery — and loud, because this leaves a driver on
        // the way that nothing here can track.
        return {
          ok: false,
          error: 'Uber accepted the delivery but returned no id',
          retryable: false,
        };
      }

      return { ok: true, reference };
    },

    async track(reference) {
      const response = await authorised(
        `/v1/customers/${config.customerId}/deliveries/${encodeURIComponent(reference)}`,
        { method: 'GET' },
      );
      if (!response?.ok) return null;

      const body = (await response.json().catch(() => null)) as
        | (DeliveryResponse & { dropoff_eta?: unknown })
        | null;
      if (typeof body?.status !== 'string') return null;

      const eta = body.dropoff_eta;
      return {
        status: body.status,
        etaMinutes: typeof eta === 'number' && Number.isFinite(eta) ? Math.round(eta) : null,
      };
    },
  };
}
