/**
 * Push-notification deep links — main brief §17.10.
 *
 * The contract the brief states, and the three behaviours it requires:
 *
 *   push notification -> parse target -> navigate to exact destination
 *   inactive app      -> preserve target until navigation tree is ready
 *   signed-out user   -> route through authentication, then continue to target
 *
 * The second and third are the ones that get skipped, and they are the ones
 * customers notice. A campaign push that opens the app on Home instead of on
 * the dish it advertised has wasted the message and the goodwill; a push that
 * dumps a signed-out member on a sign-in screen and then forgets where they
 * were going has done worse.
 *
 * So a target is parsed into data here, held, and resolved once the app can
 * actually honour it. Nothing in this file navigates — it turns an untrusted
 * string into a typed destination, or into nothing.
 */

/** Brief §17.10. */
export type DeepLinkTarget =
  | { type: 'campaign'; campaignId: string }
  | { type: 'menuItem'; itemId: string }
  | { type: 'event'; eventId: string }
  | { type: 'reward'; rewardId: string }
  | { type: 'reservation'; reservationId?: string };

/** Which targets require a signed-in account before they make sense. */
const REQUIRES_ACCOUNT: ReadonlySet<DeepLinkTarget['type']> = new Set([
  'reward',
  'reservation',
]);

export function requiresAccount(target: DeepLinkTarget): boolean {
  return REQUIRES_ACCOUNT.has(target.type);
}

/**
 * Turn a notification payload into a target.
 *
 * Returns null for anything unrecognised. A push payload arrives from
 * outside the app and an id from one is about to be put into a route, so
 * each branch checks that the id is a non-empty string of the shape our own
 * ids take — a target that fails to parse opens Home, which is a mild
 * disappointment, where a target that parses into nonsense is a crash or a
 * route injection.
 */
export function parseDeepLinkTarget(raw: unknown): DeepLinkTarget | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const data = raw as Record<string, unknown>;
  const type = data.type;

  const id = (key: string): string | null => {
    const value = data[key];
    return typeof value === 'string' && ID_PATTERN.test(value) ? value : null;
  };

  switch (type) {
    case 'campaign': {
      const campaignId = id('campaignId');
      return campaignId ? { type: 'campaign', campaignId } : null;
    }
    case 'menuItem': {
      const itemId = id('itemId');
      return itemId ? { type: 'menuItem', itemId } : null;
    }
    case 'event': {
      const eventId = id('eventId');
      return eventId ? { type: 'event', eventId } : null;
    }
    case 'reward': {
      const rewardId = id('rewardId');
      return rewardId ? { type: 'reward', rewardId } : null;
    }
    case 'reservation': {
      // The only target whose id is genuinely optional: "open reservations"
      // is a valid destination with nothing to open.
      const reservationId = id('reservationId');
      return reservationId
        ? { type: 'reservation', reservationId }
        : { type: 'reservation' };
    }
    default:
      return null;
  }
}

/**
 * Ids we will route on: letters, digits, hyphens and underscores.
 *
 * Deliberately narrow. Every id this app mints fits it, and excluding
 * slashes, dots and percent signs is what stops a payload id from climbing
 * out of its route segment.
 */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

/** The in-app path a target resolves to. */
export function pathForTarget(target: DeepLinkTarget): string {
  switch (target.type) {
    case 'campaign':
      return `/offers/${target.campaignId}`;
    case 'menuItem':
      return `/product/${target.itemId}`;
    case 'event':
      return `/events/${target.eventId}`;
    case 'reward':
      return `/rewards/${target.rewardId}`;
    case 'reservation':
      return target.reservationId ? `/reserve/${target.reservationId}` : '/reserve';
  }
}

/**
 * Holds a target the app could not act on yet.
 *
 * Covers both deferred cases from the brief: the app was cold and the
 * navigation tree did not exist, or the customer had to sign in first. One
 * slot, because a second pending target means the first was already
 * overtaken — the customer tapped a newer notification, and that is the one
 * they want.
 */
class PendingTarget {
  private target: DeepLinkTarget | null = null;

  set(target: DeepLinkTarget): void {
    this.target = target;
  }

  /** Read and clear. A target must only ever be honoured once. */
  take(): DeepLinkTarget | null {
    const target = this.target;
    this.target = null;
    return target;
  }

  peek(): DeepLinkTarget | null {
    return this.target;
  }

  clear(): void {
    this.target = null;
  }
}

export const pendingDeepLink = new PendingTarget();
