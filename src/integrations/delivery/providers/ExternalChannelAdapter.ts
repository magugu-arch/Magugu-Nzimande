/**
 * The shared body of the two external channel adapters.
 *
 * Both Uber Eats and Mr D are reached the same way, and it is worth being
 * precise about what that way is, because it is the single most important
 * architectural decision in this extension.
 *
 * **The app never calls a provider API.** It calls a Pappas-owned broker
 * endpoint, and the broker calls the provider. This is not indirection for
 * its own sake — it is the only arrangement in which extension §1's "Never
 * expose provider secrets in the mobile app" and §11's "No provider secret is
 * shipped to the client" can both be true. A mobile bundle is a file anyone
 * can download and read; an `EXPO_PUBLIC_UBER_EATS_KEY` is a published key.
 * Signing requests on device is not an option, so the credential lives on a
 * server and the device authenticates as the customer, not as the merchant.
 *
 * It also means this file can be written honestly today. The broker's
 * endpoint shape is *ours* to define, so defining it invents nothing. What
 * would be invented — and what extension §10.12 forbids — is a guess at Uber
 * Eats' or Mr D's own request bodies, status names or auth scheme. Those live
 * behind the broker, and behind a signed contract that does not exist yet.
 * `docs/DELIVERY_INTEGRATION.md` records exactly what each provider must
 * supply before the broker can be built.
 *
 * Until `EXPO_PUBLIC_CHANNEL_BROKER_URL` is set, every method here fails with
 * `NOT_CONFIGURED`. That is the brief's own skeleton behaviour (§4), kept, but
 * reached through the real code path rather than by a hard-coded `throw` that
 * would have to be deleted later.
 */

import { config } from '../../../constants/config';
import type {
  AddressCheck,
  CanonicalOrderStatus,
  DeliveryAddress,
  DeliveryProvider,
  ProviderCapability,
  ProviderId,
  ProviderOrderRequest,
  ProviderOrderResult,
  ProviderQuote,
  ProviderUnavailableReason,
} from '../types';
import { ProviderOrderRejected } from './PappasDirectAdapter';

/** How long a broker call may take before we stop waiting. */
const BROKER_TIMEOUT_MS = 12_000;

/**
 * The broker's reply shapes.
 *
 * These are Pappas' own contract, documented in
 * `docs/DELIVERY_INTEGRATION.md`. The broker is responsible for translating
 * each provider's vocabulary into these; the app never sees a provider's
 * native status string.
 */
interface BrokerQuoteReply {
  available: boolean;
  deliveryFeeCents?: number;
  etaMinutes?: number;
  reason?: ProviderUnavailableReason;
  detail?: string;
  expiresAt?: string;
}

interface BrokerAddressReply {
  serviceable: boolean;
  reason?: ProviderUnavailableReason;
  detail?: string;
}

interface BrokerOrderReply {
  externalOrderId: string;
  status: CanonicalOrderStatus;
  etaMinutes?: number;
  trackingUrl?: string;
}

/** Raised when the broker itself is unreachable or unconfigured. */
export class BrokerUnavailable extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly reason: ProviderUnavailableReason,
    detail?: string,
  ) {
    super(`${provider}: ${reason}${detail ? ` (${detail})` : ''}`);
    this.name = 'BrokerUnavailable';
  }
}

export abstract class ExternalChannelAdapter implements DeliveryProvider {
  abstract readonly id: ProviderId;
  abstract readonly displayName: string;

  /**
   * What this provider can do *once connected*.
   *
   * Declared per-subclass from the provider's own public product
   * description — extension §2 and §12 cite the App Store listings as the
   * source. These are a statement of intent for the UI to plan around, not a
   * claim that the capability works right now: `isConfigured()` is what says
   * whether anything can actually be called. A screen must check both.
   */
  protected abstract readonly declaredCapabilities: readonly ProviderCapability[];

  /** True once a broker URL exists to call. */
  protected isConfigured(): boolean {
    return config.channels.brokerBaseUrl.length > 0;
  }

  async getCapabilities(): Promise<readonly ProviderCapability[]> {
    // Capabilities are answerable offline, and answering them while
    // unconfigured is what lets the UI say "Uber Eats — delivery, pickup and
    // scheduled ordering, coming soon" instead of an empty row.
    return this.declaredCapabilities;
  }

  async validateAddress(address: DeliveryAddress): Promise<AddressCheck> {
    if (!this.isConfigured()) {
      return { serviceable: false, reason: 'NOT_CONFIGURED' };
    }
    try {
      const reply = await this.call<BrokerAddressReply>('validate-address', { address });
      return {
        serviceable: reply.serviceable,
        reason: reply.reason,
        detail: reply.detail,
      };
    } catch (error) {
      return {
        serviceable: false,
        reason: reasonFor(error),
        detail: error instanceof Error ? error.message : undefined,
      };
    }
  }

  async quote(request: ProviderOrderRequest): Promise<ProviderQuote> {
    if (!this.isConfigured()) {
      return { available: false, reason: 'NOT_CONFIGURED' };
    }
    // A quote failure is a normal outcome, not an exception: the customer is
    // simply shown that this channel cannot serve them and offered another.
    // Throwing here would make every caller wrap the call in try/catch to
    // render a state the contract can express directly.
    try {
      const reply = await this.call<BrokerQuoteReply>('quote', { request });
      return {
        available: reply.available,
        deliveryFeeCents: reply.deliveryFeeCents,
        etaMinutes: reply.etaMinutes,
        reason: reply.reason,
        detail: reply.detail,
        expiresAt: reply.expiresAt,
      };
    } catch (error) {
      return {
        available: false,
        reason: reasonFor(error),
        detail: error instanceof Error ? error.message : undefined,
      };
    }
  }

  async createOrder(request: ProviderOrderRequest): Promise<ProviderOrderResult> {
    if (!this.isConfigured()) {
      throw new ProviderOrderRejected(this.id, 'NOT_CONFIGURED');
    }

    // Order creation *does* throw, unlike quoting: there is no partial
    // success to render. Either the provider has the order or it does not,
    // and a caller that ignored a falsy return would leave a customer
    // believing dinner is coming.
    //
    // The idempotency key travels in a header as well as the body. Brokers
    // and gateways commonly key on the header; providers that key on the body
    // still see it. Sending both costs nothing and means a retry after a
    // timeout cannot become a second order — extension §5 and §11.
    const reply = await this.call<BrokerOrderReply>(
      'create-order',
      { request },
      {
        'Idempotency-Key': request.idempotencyKey,
      },
    );

    return {
      provider: this.id,
      externalOrderId: reply.externalOrderId,
      status: reply.status,
      etaMinutes: reply.etaMinutes,
      trackingUrl: reply.trackingUrl,
    };
  }

  async cancelOrder(externalOrderId: string, reason: string): Promise<void> {
    if (!this.isConfigured()) {
      throw new BrokerUnavailable(this.id, 'NOT_CONFIGURED');
    }
    await this.call<unknown>('cancel-order', { externalOrderId, reason });
  }

  /**
   * One call to the Pappas broker.
   *
   * Every request is scoped to `this.id`, so the broker knows which provider
   * to route to and the app never constructs a provider-specific URL.
   */
  private async call<T>(
    action: string,
    body: Record<string, unknown>,
    extraHeaders: Record<string, string> = {},
  ): Promise<T> {
    const base = config.channels.brokerBaseUrl.replace(/\/+$/, '');
    const url = `${base}/channels/${this.id}/${action}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BROKER_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new BrokerUnavailable(
          this.id,
          response.status >= 500 ? 'PROVIDER_ERROR' : 'PROVIDER_ERROR',
          `HTTP ${response.status}`,
        );
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * Turn a thrown error into the closed-set reason the UI renders.
 *
 * Anything we did not classify is `PROVIDER_ERROR` — "currently
 * unavailable" — rather than `NOT_CONFIGURED`. The difference matters: one
 * invites the customer to try again, the other tells them a channel does not
 * exist yet, and guessing wrong in the optimistic direction is the one that
 * loses an order.
 */
function reasonFor(error: unknown): ProviderUnavailableReason {
  if (error instanceof BrokerUnavailable) return error.reason;
  return 'PROVIDER_ERROR';
}
