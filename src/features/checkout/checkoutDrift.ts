import type { PaymentMethod } from '@/types';
import { formatPrice } from '@/utils/money';
import { methodHasExpired } from './cardExpiry';

/**
 * What changed between the screen the customer read and the tap they made.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `handlePlaceOrder` already re-reads the clock before it spends any money.
 * `missingFulfilmentRequirement` is run a second time against a fresh `new
 * Date()` rather than trusting the `blocker` memo, because "the branch closed"
 * and "the scheduled slot passed" are true of the tap, not of the render — and
 * that check is where the comment "this is the line where the money moves"
 * sits.
 *
 * It re-checks exactly one of the five things the screen decided, and the two
 * it leaves out are the two that decide what the card is charged and whether
 * the card can be charged at all.
 *
 * **The price.** The total is recomputed at the tap — `const totalsNow =
 * getTotals()` — precisely because a voucher can expire between a render and a
 * tap, and then the recomputed figure is handed straight to `authorise`. The
 * new number is the correct number; nobody tells the customer it is a
 * different one. They read R215 under a button, pressed it, and their card was
 * authorised for R245.
 *
 * `useNow` keeps the screen honest on a one-minute tick, so the window is
 * usually under a minute — and a minute wide open on the one screen in the app
 * that takes money is a minute too many. The brief's rule is that pricing is
 * recalculated before payment; it does not say the customer is charged the
 * result without being shown it.
 *
 * **The card.** `offeredPaymentMethods` filters out a card that has run out,
 * and checkout calls it inside a `useMemo` keyed on the saved list and the
 * fulfilment type. The clock is not in those dependencies, so the filter runs
 * once per screen and its answer never changes however long the screen is
 * open. A card expiring at the end of this month stays selectable into next
 * month, and the submit path re-checks fulfilment but never the card — so the
 * app authorises against a card it has itself already decided is dead, and the
 * customer learns it from the gateway, after committing.
 *
 * ── The rule ───────────────────────────────────────────────────────────────
 * Never charge a figure other than the one on screen. Not more, and not less
 * either: a total that fell is still a total the customer did not agree to,
 * and a basket that silently repriced downwards is a basket that can silently
 * reprice upwards on the next build. The customer is shown what changed and
 * presses the button again, against a screen that now says the truth.
 *
 * Nothing has been sent when either of these fires, so both are as retryable
 * as a decline — which is what the screen reports them as.
 */

/**
 * The total the customer read against the total the card would be charged.
 *
 * `shown` is the render's figure, `charged` the one recomputed at the tap.
 * Returns null when they agree, which is the ordinary case and must stay
 * cheap: this runs on every tap of the one button that matters.
 */
export function priceDrift(shown: number, charged: number): string | null {
  if (shown === charged) return null;

  /*
    Said as two amounts rather than a difference. "R30 more" is arithmetic the
    customer has to trust; "was R215, now R245" is two numbers they can check
    against the screen they are looking at, one of which is about to change
    under them.
  */
  const direction = charged > shown ? 'gone up' : 'come down';
  return `Your total has ${direction} — it was ${formatPrice(shown)} and is now ${formatPrice(charged)}. Nothing has been charged. Check the new total and place the order again.`;
}

/**
 * Whether the chosen way to pay is still a way to pay.
 *
 * Only cards can run out — rails carry no expiry and must never be caught by
 * this — and an expiry the app cannot parse is not an expiry it may act on.
 * Both of those live in `cardHasExpired`, which is why this defers to it
 * rather than reading the field itself.
 */
export function paymentNoLongerValid(method: PaymentMethod, now: Date = new Date()): string | null {
  if (!methodHasExpired(method, now)) return null;

  // Named, because the customer has two or three saved cards and "your card
  // expired" leaves them guessing which.
  return (
    `${method.label} expired ${method.expiry ?? ''}`.trim() +
    '. Nothing has been charged. Choose another way to pay.'
  );
}

/**
 * Both checks, in the order a customer would want to hear them.
 *
 * The card first: a dead card is a thing they must fix before the price is
 * worth reading, and telling somebody their total moved when they cannot pay
 * either way is two problems delivered as one.
 */
export function checkoutStillHonest(args: {
  shownTotal: number;
  chargedTotal: number;
  method: PaymentMethod;
  now?: Date;
}): string | null {
  const { shownTotal, chargedTotal, method, now = new Date() } = args;
  return paymentNoLongerValid(method, now) ?? priceDrift(shownTotal, chargedTotal);
}
