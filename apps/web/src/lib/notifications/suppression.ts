import { mutateState, pushAudit, readState } from '../demo-state';

/**
 * Addresses we must stop emailing, and why.
 *
 * Two different obligations meet here and it is worth keeping them apart.
 *
 * A hard bounce is a deliverability obligation: continuing to send to an
 * address that does not exist is what gets a sending domain's reputation
 * ruined, and then the confirmations that *would* have arrived stop arriving
 * for everybody.
 *
 * A complaint is a legal one. Somebody who marks a message as spam has
 * withdrawn consent, and POPIA §11(3)(b) means that withdrawal has to be
 * honoured — not noted.
 *
 * A soft bounce is neither. A mailbox that was full this morning is a mailbox
 * that works this afternoon, and suppressing on it would quietly cut customers
 * off for a transient condition. That distinction is the whole reason this
 * module reads the reason rather than counting failures.
 */

export type SuppressionReason = 'hard-bounce' | 'complaint' | 'unsubscribed';

export type Suppressed = {
  /** Lower-cased, because an address is not case-sensitive in the part we match. */
  addressKey: string;
  address: string;
  reason: SuppressionReason;
  at: string;
};

const keyFor = (address: string) => address.trim().toLowerCase();

export function isSuppressed(address: string): boolean {
  const key = keyFor(address);
  return readState().suppressed.some((entry) => entry.addressKey === key);
}

export function suppressionFor(address: string): Suppressed | null {
  const key = keyFor(address);
  return readState().suppressed.find((entry) => entry.addressKey === key) ?? null;
}

export function listSuppressed(): Suppressed[] {
  return [...readState().suppressed].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * Records an address as unsendable.
 *
 * The first reason wins. An address that complained and later hard-bounced is
 * still a complaint: the legal obligation is the stronger of the two and
 * overwriting it with a deliverability note would lose why we stopped.
 */
export function suppress(address: string, reason: SuppressionReason): void {
  const key = keyFor(address);

  mutateState((state) => {
    if (state.suppressed.some((entry) => entry.addressKey === key)) return;

    state.suppressed.push({
      addressKey: key,
      address: address.trim(),
      reason,
      at: new Date().toISOString(),
    });
    if (state.suppressed.length > 5_000) state.suppressed.shift();

    pushAudit(state, 'notifications', `Stopped emailing an address (${reason})`);
  });
}

/**
 * Lets an address through again.
 *
 * Only for a hard bounce — a mistyped address the customer has since
 * corrected, or a mailbox that has been recreated. A complaint is not
 * reversible from this side: consent is the customer's to give back, and the
 * only honest way to do it is for them to place another order, which is not
 * this function.
 */
export function unsuppress(address: string): boolean {
  const key = keyFor(address);

  return mutateState((state) => {
    const entry = state.suppressed.find((candidate) => candidate.addressKey === key);
    if (!entry || entry.reason !== 'hard-bounce') return false;

    state.suppressed = state.suppressed.filter((candidate) => candidate.addressKey !== key);
    pushAudit(state, 'notifications', 'Allowed a bounced address again');
    return true;
  });
}

/**
 * Mailgun's event names, mapped onto what we do about them.
 *
 * `temporary_fail` deliberately returns null. It is the event most likely to be
 * treated as a bounce by someone reading the list quickly, and doing so cuts a
 * customer off because their mailbox was briefly full.
 */
export function reasonForMailgunEvent(event: string): SuppressionReason | null {
  switch (event.trim().toLowerCase()) {
    case 'permanent_fail':
    case 'failed':
      return 'hard-bounce';
    case 'complained':
      return 'complaint';
    case 'unsubscribed':
      return 'unsubscribed';
    default:
      // delivered, opened, clicked, temporary_fail, accepted — none of which
      // stop us sending.
      return null;
  }
}

/**
 * Whether a Mailgun webhook token has already been acted on.
 *
 * In the shared state rather than a module Set, for the same reason as
 * everything else in this application: the server runs several workers, and a
 * replay guard one of them keeps to itself is not a guard.
 */
export function tokenAlreadySeen(token: string): boolean {
  return readState().notifications.webhookTokens.includes(token);
}

export function rememberToken(token: string): void {
  mutateState((state) => {
    if (state.notifications.webhookTokens.includes(token)) return;
    state.notifications.webhookTokens.push(token);
    // Only has to outlive the freshness window the signature check enforces.
    if (state.notifications.webhookTokens.length > 1_000) {
      state.notifications.webhookTokens.shift();
    }
  });
}
