/**
 * Analytics — brief §15.
 *
 * §15 names eleven events and then says what they are for: "dashboards around
 * conversion, cart abandonment, fulfilment mix, top items and repeat ordering".
 * That second sentence is what decides the shape of this file, because a
 * funnel dashboard is only as good as the weakest event in the chain — one
 * step that never fires, or fires with a different payload on iOS, and the
 * whole conversion rate is wrong in a way nobody notices for a quarter.
 *
 * So the event names and their payloads are a type, not a convention. A
 * misspelled event or a missing field is a compile error rather than a hole in
 * a chart six weeks later.
 *
 * ── Two taxonomies, reconciled ─────────────────────────────────────────────
 * The brief gives the list twice and they do not match. §15 asks for
 * `view_menu, select_fulfilment, select_store, view_item, add_to_cart,
 * begin_checkout, add_payment_info, purchase, reward_redeem, reorder,
 * support_contact`; the starter kit's `src/ux/analytics.ts` asks for
 * `fulfilment_selected, store_selected, category_viewed, …` — the same ideas
 * in the opposite naming convention, plus five §15 does not have.
 *
 * §15's names win, for a reason beyond it being the more detailed section:
 * `view_item`, `add_to_cart`, `begin_checkout`, `add_payment_info`, `purchase`,
 * `search` and `view_cart` are GA4's *reserved* ecommerce event names. Sent
 * under those names they populate GA4's built-in funnel and monetisation
 * reports — which is precisely the "dashboards around conversion and cart
 * abandonment" §15 asks for — and sent under any other name they are custom
 * events somebody has to build those reports out of by hand.
 *
 * The five concepts only the starter kit had are kept, named in §15's style:
 * `select_category`, `search`, `select_modifier`, `view_cart`,
 * `view_order_status`.
 *
 * ── No personal information leaves the device ──────────────────────────────
 * Every payload below is ids, counts and amounts. No name, email, phone or
 * address, and no free text a customer typed — `search` carries the length of
 * the query and whether it matched, never the query. That is a POPIA position
 * as much as a taste one, and `analytics.test.ts` holds the payload types to
 * it so a well-meaning `customerEmail` cannot be added later.
 *
 * ── Nothing is sent until a provider is injected ───────────────────────────
 * There is no vendor SDK in this file and none in the bundle. `setAnalyticsAdapter`
 * takes one at startup; until then events go to the console in development and
 * nowhere at all in production. Choosing the provider is a decision bb.q has
 * not made yet, and an analytics SDK is not something to guess at — it ships
 * an identifier for every customer.
 */
import type { FulfilmentType } from '@/types';

/** ZAR, as a number of rand — the same unit the cart works in. */
type Amount = number;

/**
 * Every event, with the payload it must carry.
 *
 * Adding an event here and nowhere else is deliberate: the compiler then tells
 * you every call site that needs it.
 */
export interface AnalyticsEvents {
  // ── Discovery ───────────────────────────────────────────────────────────
  /** §15 `view_menu`. The menu opened, however they got there. */
  view_menu: { categoryCount: number };
  /** A category chip or a Home tile. Feeds "top items" by section. */
  select_category: { categoryId: string; productCount: number };
  /**
   * GA4 reserved. The query itself is never sent — only its shape and whether
   * it found anything, which is what tells you the menu is missing a synonym.
   */
  search: { queryLength: number; resultCount: number };
  /** GA4 reserved. §15 `view_item`. */
  view_item: { productId: string; categoryId: string; price: Amount };
  /** Which options people actually change, and what it costs them. */
  select_modifier: { productId: string; groupId: string; optionId: string; priceDelta: Amount };

  // ── Fulfilment ──────────────────────────────────────────────────────────
  /** §15 `select_fulfilment`. The "fulfilment mix" dashboard is this event. */
  select_fulfilment: { fulfilment: FulfilmentType };
  /** §15 `select_store`. */
  select_store: { storeId: string; fulfilment: FulfilmentType; isOpen: boolean };

  // ── The funnel ──────────────────────────────────────────────────────────
  /** GA4 reserved. §15 `add_to_cart`. */
  add_to_cart: { productId: string; categoryId: string; quantity: number; value: Amount };
  /** GA4 reserved. The step between adding and checking out. */
  view_cart: { itemCount: number; value: Amount };
  /** GA4 reserved. §15 `begin_checkout`. Cart abandonment is measured here. */
  begin_checkout: { itemCount: number; value: Amount; fulfilment: FulfilmentType };
  /** GA4 reserved. §15 `add_payment_info`. Never the card, only its kind. */
  add_payment_info: { paymentType: string; value: Amount };
  /**
   * GA4 reserved. §15 `purchase`. The one event that must never be sent twice
   * for one order, so it carries the order id for the warehouse to dedupe on.
   */
  purchase: {
    orderId: string;
    value: Amount;
    fees: Amount;
    discount: Amount;
    itemCount: number;
    fulfilment: FulfilmentType;
    storeId: string;
  };

  // ── After the order ─────────────────────────────────────────────────────
  /** My Journey opened. Distinguishes "tracked it" from "ordered and left". */
  view_order_status: { orderId: string; status: string };
  /** §15 `reorder`. The "repeat ordering" dashboard is this event. */
  reorder: { orderId: string; itemCount: number };
  /** §15 `reward_redeem`. */
  reward_redeem: { rewardId: string; pointsCost: number; value: Amount };
  /** §15 `support_contact`. */
  support_contact: { topicId: string };
}

export type AnalyticsEvent = keyof AnalyticsEvents;

/**
 * Where events go. Implement this against the chosen provider and hand it to
 * `setAnalyticsAdapter` at startup — nothing else in the app changes.
 */
export interface AnalyticsAdapter {
  track<E extends AnalyticsEvent>(event: E, payload: AnalyticsEvents[E]): void;
  /**
   * Tie subsequent events to a customer. Called on sign-in with the account
   * id, and with `null` on sign-out so the next person is not recorded as the
   * last one.
   */
  identify?(userId: string | null): void;
}

let adapter: AnalyticsAdapter | null = null;

export function setAnalyticsAdapter(next: AnalyticsAdapter | null): void {
  adapter = next;
}

/**
 * Record something the customer did.
 *
 * Never throws. An analytics provider having a bad day must not take an order
 * with it — this sits on the path between "Place order" and a confirmation
 * screen, and a thrown error there costs a sale to measure a sale.
 */
export function track<E extends AnalyticsEvent>(event: E, payload: AnalyticsEvents[E]): void {
  try {
    adapter?.track(event, payload);
  } catch {
    // Deliberately swallowed. See above.
  }

  if (__DEV__ && !adapter) {
    // eslint-disable-next-line no-console
    console.info('[bb.q analytics]', event, payload);
  }
}

/** As `track`, for the identity call. Never throws, for the same reason. */
export function identify(userId: string | null): void {
  try {
    adapter?.identify?.(userId);
  } catch {
    // Deliberately swallowed.
  }
}

/**
 * The full taxonomy, for the test that holds this file to §15 and for whoever
 * configures the provider — most want the event list declared up front.
 */
export const ANALYTICS_EVENTS = [
  'view_menu',
  'select_category',
  'search',
  'view_item',
  'select_modifier',
  'select_fulfilment',
  'select_store',
  'add_to_cart',
  'view_cart',
  'begin_checkout',
  'add_payment_info',
  'purchase',
  'view_order_status',
  'reorder',
  'reward_redeem',
  'support_contact',
] as const satisfies readonly AnalyticsEvent[];
