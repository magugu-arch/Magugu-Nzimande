/**
 * Mr D.
 *
 * Same arrangement as the Uber Eats adapter: the brief's §4 skeleton
 * behaviour — refuse everything until configured — reached through the real
 * broker path so that connecting the channel is configuration rather than a
 * rewrite.
 *
 * The capability list is the brief's own, in §4, and it is deliberately
 * shorter than Uber Eats': no `pickup` and no `scheduled-order`. Extension §2
 * describes Mr D's public product as address-based restaurant discovery,
 * several payment methods, promotions and live order tracking — delivery to
 * an address, with no collection journey stated. Claiming `pickup` here would
 * put a collection option in front of a customer that the channel cannot
 * honour, which is the failure §5's "never display fake live ETA, fake driver
 * data or fake confirmation" rule exists to prevent, one step earlier in the
 * journey.
 *
 * If a signed contract turns out to expose Pickup, adding it here is a
 * one-line change and the registry picks it up without any screen knowing.
 */

import type { ProviderCapability } from '../types';
import { ExternalChannelAdapter } from './ExternalChannelAdapter';

export class MrDAdapter extends ExternalChannelAdapter {
  readonly id = 'mr-d' as const;

  /** Plain text, in Pappas' own type. No partner mark — extension §10.11. */
  readonly displayName = 'Mr D';

  protected readonly declaredCapabilities: readonly ProviderCapability[] = [
    'delivery',
    'eta',
    'live-tracking',
    'webhooks',
  ] as const;
}
