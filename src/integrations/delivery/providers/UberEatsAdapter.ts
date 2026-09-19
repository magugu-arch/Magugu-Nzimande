/**
 * Uber Eats.
 *
 * Extension §4 supplies a skeleton whose every method throws
 * `UBER_EATS_NOT_CONFIGURED`. That behaviour is kept — nothing here can
 * succeed until a merchant contract and broker exist — but it is reached
 * through `ExternalChannelAdapter`'s real code path rather than a hard-coded
 * throw, so connecting the channel is a matter of setting a broker URL rather
 * than rewriting the class.
 *
 * The capability list is the one the brief states in §4, and §2 and §12 give
 * its provenance: Uber Eats' own App Store listing describes restaurant
 * discovery, delivery, Pickup, scheduled ordering and real-time tracking.
 * That is a public product description, not an API contract, and it is used
 * here only to say what the channel is *for*. No request shape, status name,
 * authentication scheme or endpoint has been guessed — extension §10.12.
 *
 * What is still required before this works is recorded in
 * `docs/DELIVERY_INTEGRATION.md` and summarised there as blockers, not
 * silently assumed here.
 */

import type { ProviderCapability } from '../types';
import { ExternalChannelAdapter } from './ExternalChannelAdapter';

export class UberEatsAdapter extends ExternalChannelAdapter {
  readonly id = 'uber-eats' as const;

  /**
   * The channel's name, as plain text.
   *
   * Extension §10.11: do not copy Uber Eats branding, colours, logos or
   * proprietary UI. Naming a partner is necessary — a customer choosing a
   * channel has to know which one — but the row renders in Pappas' own type
   * and palette, with no partner mark. That is why this is a string and not
   * an image asset.
   */
  readonly displayName = 'Uber Eats';

  protected readonly declaredCapabilities: readonly ProviderCapability[] = [
    'delivery',
    'pickup',
    'scheduled-order',
    'eta',
    'live-tracking',
    'webhooks',
  ] as const;
}
