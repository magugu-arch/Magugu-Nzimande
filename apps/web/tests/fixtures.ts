import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PRODUCTS, PROMOTIONS, STORES, optionGroupsFor } from '@bbq/seed';
import type {
  OptionGroup,
  Promotion,
  Order,
  OrderLine,
  OrderStatus,
  PaymentIntent,
  Product,
  ServiceMode,
  Store,
} from '@bbq/types';
import { statesForMode } from '@bbq/types';
import { expect, vi } from 'vitest';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { POST as signInRoute } from '@/app/api/admin/session/route';
import { CUSTOMER_COOKIE } from '@/lib/accounts/session';
import { SESSION_COOKIE } from '@/lib/admin-auth';
import { mutateState, readState } from '@/lib/demo-state';
import { advanceOrder, setOrderStatus } from '@/lib/order-store';
import { repriceLines } from '@/lib/order-integrity';
import { promotionFor } from '@/lib/promotions';
import { intentForOrder, settle } from '@/lib/payments/ledger';
import { signBody } from '@/lib/payments/provider';
import { SANDBOX_SIGNATURE_HEADER } from '@/lib/payments/sandbox-provider';
import { FIXED_NOW } from './setup';

/**
 * Shared fixtures for the route-level suites.
 *
 * Two suites had grown their own copies of "build a valid order line" and
 * "sign in and keep the cookie", which is how two tests come to disagree about
 * what a valid order looks like and neither one is wrong. One definition here,
 * and a suite that needs a variant asks for it rather than rewriting it.
 *
 * Everything reads from the seed catalogue rather than hard-coding a slug or a
 * price, so a change to the menu moves the tests with it instead of leaving
 * them green against a product that no longer exists.
 */

export const CONSOLE_PASSPHRASE = 'twice-fried-in-olive-oil';

// ---------------------------------------------------------------------------
// Picking things out of the seed catalogue
// ---------------------------------------------------------------------------

/**
 * Throws rather than returning undefined: a missing fixture is a broken test.
 *
 * Exported because a suite had written its own — `must<T>`, same signature,
 * same body — to avoid the non-null assertions that turn "the seed has no
 * chicken" into a type error three lines from the cause.
 */
export function required<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`the seed catalogue has no ${what} to test with`);
  }
  return value;
}

/**
 * A seeded product by its slug.
 *
 * Two suites had this, with two different throw messages, because the tests
 * that care about option shapes need a *named* product rather than whichever
 * one happens to be first.
 */
export function productBySlug(slug: string): Product {
  return required(
    PRODUCTS.find((candidate) => candidate.slug === slug),
    `product ${slug}`,
  );
}

/**
 * Any product or store that is not this one.
 *
 * For the tests that check a console change touched only what it named. The
 * interesting assertion is about the *other* one, and reaching for it by index
 * breaks the day the seed is reordered.
 */
export function aProductOtherThan(product: Product): Product {
  return required(
    PRODUCTS.find((candidate) => candidate.slug !== product.slug),
    'a second product',
  );
}

export function aStoreOtherThan(store: Store): Store {
  return required(
    STORES.find((candidate) => candidate.id !== store.id),
    'a second store',
  );
}

/**
 * The seed as it was shipped, for the tests that check the console did not
 * write into it.
 *
 * The console layers its changes over the catalogue rather than mutating it,
 * and if that ever stopped being true one sold-out product would survive
 * `resetState` and every later suite would inherit it. These read the untouched
 * article so the assertion says what it means: not "the catalogue says X" but
 * "the seed still says X".
 */
export function seededProduct(slug: string): Product {
  return productBySlug(slug);
}

export function seededStore(id: string): Store {
  return required(
    STORES.find((candidate) => candidate.id === id),
    `store ${id}`,
  );
}

export function aChickenProduct(): Product {
  return required(
    PRODUCTS.find((product) => product.category === 'Chicken'),
    'chicken product',
  );
}

export function aProduct(): Product {
  return required(PRODUCTS[0], 'products at all');
}

/** One product from each category, since each gets a different option shape. */
export function aProductIn(category: Product['category']): Product {
  return required(
    PRODUCTS.find((product) => product.category === category),
    `${category} product`,
  );
}

/** The one product that lets the customer choose two sauces at once. */
export function halfAndHalf(): Product {
  return required(
    PRODUCTS.find((product) => product.slug === 'half-half'),
    'half-and-half product',
  );
}

/** A store that takes delivery orders, with at least one suburb on its list. */
export function aDeliveryStore(): Store {
  return required(
    STORES.find((store) => store.services.Delivery && store.zones.length > 0),
    'store offering delivery',
  );
}

export function aCollectionStore(): Store {
  return required(
    STORES.find((store) => store.services.Collection),
    'store offering collection',
  );
}

export function sizeGroupOf(product: Product): OptionGroup {
  return required(
    optionGroupsFor(product).find((group) => group.key === 'size'),
    `size group on ${product.slug}`,
  );
}

/**
 * A choice that makes a line *cheaper* — the half bird is R70 off a whole one.
 * The interesting one for pricing tests: a discount claimed twice is worth
 * more than a surcharge claimed twice.
 */
export function aDiscountingChoice(group: OptionGroup): { label: string; deltaCents: number } {
  return required(
    group.choices.find((choice) => choice.deltaCents < 0),
    `discounting choice in ${group.key}`,
  );
}

/**
 * A store built to order, for the cases the seed catalogue cannot reach.
 *
 * Both seeded stores keep ordinary daytime hours, so the wrap-past-midnight
 * branch of `isOpenNow` has no real store that exercises it. Rather than bend
 * the seed data — which is the demo catalogue and answers to the franchisor —
 * a test that needs a store closing at 02:00 asks for one here.
 */
export function storeWithHours(opensMinute: number, closesMinute: number): Store {
  return {
    id: 'ST-TEST',
    name: 'Test Store',
    address: '1 Test Road',
    telephone: '011 000 0000',
    hours: { opensMinute, closesMinute },
    distanceKm: 1,
    services: { Delivery: true, Collection: true, 'Dine-in': true },
    zones: ['Testville'],
    halaal: 'Not certified',
  } as Store;
}

/**
 * A delivery store that covers nowhere.
 *
 * Both seeded stores have suburbs, so the branch that has stopped delivering —
 * a real thing when a store loses its driver — has no store that reaches it.
 * Built rather than seeded, for the same reason as the late-closing one.
 */
export function storeWithoutZones(): Store {
  return { ...storeWithHours(at(11), at(22)), zones: [] };
}

/** A store fixture with one service switched off, for the refusal paths. */
export function storeWithout(mode: ServiceMode): Store {
  const store = storeWithHours(at(9), at(22));
  return { ...store, services: { ...store.services, [mode]: false } };
}

/** A suburb this store's own zone list names. */
export function aSuburbOf(store: Store): string {
  return required(store.zones[0], `delivery suburb on ${store.name}`);
}

/**
 * A suburb this store does not cover.
 *
 * Taken from another branch's zone list rather than invented, because that is
 * the case that actually went wrong: an order for a real suburb that a real
 * store delivers to, sent to the store that does not. A made-up place name
 * would pass a weaker version of the same test.
 */
export function aSuburbNotServedBy(store: Store): string {
  const covered = new Set(store.zones.map((zone) => zone.toLowerCase()));
  return required(
    STORES.flatMap((candidate) => candidate.zones).find((zone) => !covered.has(zone.toLowerCase())),
    `suburb outside ${store.name}'s delivery zone`,
  );
}

/** Minutes since midnight, for readable trading-hour fixtures. */
export const at = (hour: number, minute = 0): number => hour * 60 + minute;

/**
 * A UTC instant for a given SAST wall-clock time. SAST is UTC+2, no DST.
 *
 * Built by shifting minutes off midnight rather than by formatting `hour - 2`
 * into a string. The string form looks equivalent and is not: any SAST hour
 * before 02:00 makes it negative, and `2026-09-02T-1:00:00Z` is an invalid date
 * rather than the previous evening. The promotions suite had grown exactly that
 * copy, and it would have failed the day somebody tested a midnight offer.
 */
export function sast(isoDate: string, hour: number, minute = 0): Date {
  const utcHour = hour - 2;
  const day = new Date(`${isoDate}T00:00:00Z`);
  day.setUTCMinutes(utcHour * 60 + minute);
  return day;
}

/**
 * Named days, so a test about a Wednesday offer says Wednesday.
 *
 * Real dates in the week the suite was written, kept together because the
 * relationships between them are the point: a test that moves TUESDAY without
 * moving the others silently stops testing "the day before".
 */
export const MONDAY = '2026-08-31';
export const TUESDAY = '2026-09-01';
export const WEDNESDAY = '2026-09-02';
export const THURSDAY = '2026-09-03';
export const SATURDAY = '2026-09-05';
export const SUNDAY = '2026-09-06';

/**
 * Runs a block with the clock stopped at one instant, then puts it back.
 *
 * `tests/setup.ts` already freezes time so the suite does not depend on the
 * hour it runs at; this is for the tests that need a *particular* moment — a
 * Wednesday at 11:00, a store's last minute before closing. The restore goes
 * through `finally` so a failing expectation inside the block cannot leave the
 * clock stopped for every test after it, which is the failure mode that makes a
 * suite look randomly broken.
 *
 * It moves the clock and does not switch the fake timers on: setup.ts has
 * already done that, and calling `useFakeTimers` again resets their
 * configuration. That is not theoretical — `state-lock` spins until `Date.now()`
 * passes a deadline, and re-installing the timers under it hangs the run rather
 * than failing it.
 */
export async function frozenAt<T>(instant: Date, run: () => T | Promise<T>): Promise<T> {
  vi.setSystemTime(instant);
  try {
    return await run();
  } finally {
    vi.setSystemTime(FIXED_NOW);
  }
}

/**
 * The courier provider, configured the way a deployment would be.
 *
 * Two suites had each written the same four variables out. The webhook secret
 * is separate because only the suite that verifies callbacks needs it, and a
 * fixture that always set it would hide a provider that works without one.
 */
export const UBER_ENV = {
  BBQ_COURIER_PROVIDER: 'uber-direct',
  BBQ_UBER_CLIENT_ID: 'client-id',
  BBQ_UBER_CLIENT_SECRET: 'client-secret',
  BBQ_UBER_CUSTOMER_ID: 'cus_test',
} as const;

export async function withUberDirect<T>(
  run: () => T | Promise<T>,
  webhookSecret?: string,
): Promise<T> {
  const wanted: Record<string, string> = { ...UBER_ENV };
  if (webhookSecret !== undefined) wanted.BBQ_UBER_WEBHOOK_SECRET = webhookSecret;

  const before = Object.fromEntries(
    Object.keys(wanted).map((key) => [key, process.env[key]]),
  ) as Record<string, string | undefined>;

  for (const [key, value] of Object.entries(wanted)) process.env[key] = value;

  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

// ---------------------------------------------------------------------------
// Building requests
// ---------------------------------------------------------------------------

/** A valid order line at the catalogue price, with anything overridden. */
export function orderLine(product: Product, over: Partial<OrderLine> = {}): OrderLine {
  return {
    key: `${product.slug}::`,
    slug: product.slug,
    name: product.name,
    imageKey: product.imageKey,
    quantity: 1,
    unitCents: product.priceCents,
    options: [],
    ...over,
  };
}

export const customer = {
  name: 'Thandi Mokoena',
  email: 'thandi@example.com',
  mobile: '0821234567',
};

/**
 * A complete, valid create-order body, with anything overridden.
 *
 * A delivery override gets a postal code it did not ask for. Checkout collects
 * one now — a courier needs a complete address — and without this every caller
 * that switches the mode to Delivery would have to remember a field it does not
 * care about. Overriding it explicitly still wins, which is how the tests that
 * are *about* the postal code leave it out.
 */
export function orderRequest(
  lines: OrderLine[],
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  const base = {
    storeId: aCollectionStore().id,
    mode: 'Collection',
    customer,
    lines,
    promoCode: null,
    kitchenNote: '',
    ...over,
  };

  if (base.mode !== 'Delivery' || 'postalCode' in over) return base;
  return { ...base, postalCode: '2196' };
}

/**
 * A create-order body for a delivery, complete enough for the route to take it.
 *
 * Six suites had built this by hand, between them inventing four street names
 * and forgetting the postal code twice — which the route requires for a
 * delivery, so the ones that forgot were testing the 400 rather than the thing
 * they meant to.
 *
 * The suburb comes off the store's own zone list rather than being written
 * down, so this keeps working when the seed's delivery areas change.
 */
export function deliveryRequest(over: Record<string, unknown> = {}): Record<string, unknown> {
  const store = aDeliveryStore();
  return orderRequest([orderLine(aProduct())], {
    storeId: store.id,
    mode: 'Delivery',
    address: '12 Oak Avenue',
    suburb: aSuburbOf(store),
    postalCode: '2196',
    ...over,
  });
}

/**
 * An offer that is actually running at a given moment.
 *
 * Found by asking each offer rather than by naming one, so this keeps working
 * when the seed's campaigns change — which they will, since none of them is
 * approved. A test that hard-codes a code is a test that starts failing for a
 * reason that has nothing to do with what it checks.
 *
 * Every refusal path through `promotionFor` is well covered and the success
 * path through the order route was not, because applying an offer needs the
 * clock to be inside its window, and no fixture put it there.
 */
export function aRunningOffer(
  now: Date,
  at: { mode: ServiceMode; isFirstOrder: boolean } = { mode: 'Collection', isFirstOrder: false },
): Promotion {
  /**
   * Asked under the conditions the order will actually be placed in, not just
   * against the clock.
   *
   * The first version of this asked `isRunningNow`, which answers a question
   * about the calendar — it assumes a first order on whichever mode the offer
   * names, because the offers page needs to say "running today" to everybody.
   * It duly returned a delivery-only, new-accounts-only offer, and the fixture
   * then placed a guest collection order and was refused by the route. Correct
   * refusal, useless fixture.
   */
  return required(
    PROMOTIONS.find((promotion) => promotionFor(promotion.code, { ...at, now }).ok),
    `an offer running at ${now.toISOString()} for a ${at.mode.toLowerCase()} order`,
  );
}

/**
 * A moment when at least one offer is running and the stores are open.
 *
 * Both conditions, because an order placed inside an offer's window but outside
 * trading hours is refused by the store guard before the discount is reached —
 * which is correct, and would make the discount test pass for the wrong reason
 * if it were not accounted for here.
 */
export const WHEN_AN_OFFER_RUNS = sast(WEDNESDAY, 20, 30);

/**
 * An order the API placed with an offer actually applied.
 *
 * The discount was covered as arithmetic in `pricing`, and never on an order
 * the route created — so nothing checked that a discount survives the journey
 * from a promo code in a request to the totals stored against the order, nor
 * what it does to the points that order earns.
 */
export async function aDiscountedOrder(over: Record<string, unknown> = {}): Promise<Order> {
  const offer = aRunningOffer(WHEN_AN_OFFER_RUNS);
  const product = productBySlug(offer.productSlug);

  return frozenAt(WHEN_AN_OFFER_RUNS, async () => {
    const response = await createOrderRoute(
      request('/api/orders', {
        body: orderRequest([orderLine(product)], { promoCode: offer.code, ...over }),
      }),
    );
    expect(response.status, await response.clone().text()).toBe(201);
    return (await bodyOf<{ order: Order }>(response)).order;
  });
}

/**
 * An account holding a given number of points.
 *
 * `tierFor` is covered as arithmetic, and the rung a real account stands on was
 * not: the balance is posted by completing orders, so reaching a tier boundary
 * through the front door would mean placing several. This writes the balance,
 * which is the one thing here that reaches past the API on purpose — the tier
 * boundaries are the point, not the route that arrives at them.
 */
export async function anAccountWithPoints(
  points: number,
): Promise<{ id: string; cookie: string }> {
  const account = await registerCustomer();
  mutateState((state) => {
    const held = state.accounts.find((candidate) => candidate.id === account.id);
    if (held) held.points = points;
  });
  return account;
}

/**
 * A basket of several different products.
 *
 * Every order the route-level suites place has exactly one line, so nothing
 * checked that the totals sum across a basket rather than reading the first
 * line — which is the shape of every real order and none of the tested ones.
 *
 * Distinct products rather than a quantity, because a quantity multiplies one
 * line and a basket adds several, and it is the addition that was untested.
 */
export function aBasketOf(count: number): OrderLine[] {
  const products = PRODUCTS.slice(0, count);
  if (products.length < count) {
    throw new Error(`the seed catalogue has only ${products.length} products, not ${count}`);
  }
  return products.map((product) => orderLine(product));
}

/**
 * A dine-in order, placed through the route.
 *
 * The third mode, and the one nothing ordered in. `Dine-in` was accepted by the
 * schema and rendered by `labelFor`, and no test had ever asked the API for
 * one — so the parts that differ from a collection (no address, no delivery
 * fee, and a journey that skips out_for_delivery) had never run together.
 */
export async function aDineInOrder(over: Record<string, unknown> = {}): Promise<Order> {
  const store = required(
    STORES.find((candidate) => candidate.services['Dine-in']),
    'store offering dine-in',
  );
  return placeOrder({ storeId: store.id, mode: 'Dine-in', ...over });
}

/**
 * Runs the same operation several times at once.
 *
 * `mutateState` holds a lock and is synchronous, so any single mutation is
 * atomic and the suites had reasonably assumed that settled the matter. It does
 * not: an operation that reads the state, awaits something, and then writes has
 * a window between the two where a second caller sees the world as it was.
 *
 * Two operators pressing the same button at the same moment is the ordinary
 * case, not an exotic one — a queue on a busy Saturday is worked by whoever is
 * free.
 */
export function concurrently<T>(count: number, run: () => Promise<T>): Promise<T[]> {
  return Promise.all(Array.from({ length: count }, () => run()));
}

/**
 * A string of an exact length, for the bounds the schemas enforce.
 *
 * Named rather than written as `'x'.repeat(281)` at each site, because the
 * interesting number is the limit and `281` on its own does not say which limit
 * it is one past.
 */
export const ofLength = (length: number, fill = 'x'): string => fill.repeat(length);

type RequestOptions = { body?: unknown; cookie?: string; method?: string };

/** A Request for a route handler. GET unless a body is given. */
export function request(url: string, options: RequestOptions = {}): Request {
  const { body, cookie, method } = options;
  return new Request(`http://localhost${url}`, {
    method: method ?? (body === undefined ? 'GET' : 'POST'),
    ...(cookie ? { headers: { cookie } } : {}),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

/** Route handlers take `context.params` as a promise in the App Router. */
export function params<T extends Record<string, string>>(values: T): { params: Promise<T> } {
  return { params: Promise.resolve(values) };
}

export async function bodyOf<T = Record<string, unknown>>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

/**
 * The message a refused response carries.
 *
 * Every refusal in this application answers `{ error }`, and four suites had
 * each written the type parameter out to read it. Named so a test asserting on
 * the wording says so.
 */
export async function errorOf(response: Response): Promise<string> {
  return (await bodyOf<{ error?: string }>(response)).error ?? '';
}

// ---------------------------------------------------------------------------
// Placing a real order, for the suites that need one to look at
// ---------------------------------------------------------------------------

/**
 * Places an order through the real route and returns it, so a journey test is
 * reading an order the API actually created rather than one it invented and
 * pushed into the store behind the API's back.
 */
export async function placeOrder(over: Record<string, unknown> = {}): Promise<Order> {
  const product = aProduct();
  const response = await createOrderRoute(
    request('/api/orders', { body: orderRequest([orderLine(product)], over) }),
  );
  expect(response.status).toBe(201);
  // Typed as the real Order rather than the two or three fields the first
  // caller happened to read, so the next one is not narrowed out of the rest.
  const { order } = await bodyOf<{ order: Order }>(response);
  return order;
}

/**
 * A delivery order, placed through the real route.
 *
 * The default fixture store is a collection store, so passing only
 * `mode: 'Delivery'` gets a 400 for a suburb that store does not serve — which
 * is the route being right, not the fixture being awkward. Three suites had
 * each worked that out and written the same four lines; a fourth and fifth
 * wrote them again with a different street name.
 *
 * The address is arbitrary and the suburb is not: it comes off the store's own
 * zone list, so this keeps working when the seed's delivery areas change.
 */
export async function placeDeliveryOrder(over: Record<string, unknown> = {}): Promise<Order> {
  const store = aDeliveryStore();
  return placeOrder({
    storeId: store.id,
    mode: 'Delivery',
    address: '12 Oak Avenue',
    suburb: aSuburbOf(store),
    ...over,
  });
}

/**
 * An order placed by a signed-in customer, rather than a guest.
 *
 * The difference matters to everything about loyalty: points post to an
 * account, and an order with no account behind it has nowhere to put them. The
 * accounts suite had this same six-line block four times over, once per test,
 * because `placeOrder` takes no cookie.
 */
export async function placeOrderAs(
  cookie: string,
  over: Record<string, unknown> = {},
): Promise<Order> {
  const response = await createOrderRoute(
    request('/api/orders', { cookie, body: orderRequest([orderLine(aProduct())], over) }),
  );
  expect(response.status, await response.clone().text()).toBe(201);
  const { order } = await bodyOf<{ order: Order }>(response);
  return order;
}

/**
 * An order standing at a given state, walked there through the real machine.
 *
 * `advanceOrder` rather than `setOrderStatus` on purpose: stepping through the
 * transitions is what a kitchen actually does, so a test whose precondition is
 * "ready" is set up by a route of steps the state machine allows rather than by
 * writing the word into the store. An unreachable state throws here instead of
 * failing three assertions later.
 *
 * `cancelled` is not on any path, so it is set — with the reason the store
 * requires, since a cancellation without one is refused.
 */
export async function orderAt(
  state: OrderStatus,
  over: Record<string, unknown> = {},
): Promise<Order> {
  const order = over.mode === 'Delivery' ? await placeDeliveryOrder(over) : await placeOrder(over);

  if (state === 'cancelled') {
    const cancelled = setOrderStatus(order.id, state, 'Cancelled by a fixture');
    if (!cancelled) throw new Error(`could not cancel ${order.orderNumber}`);
    return cancelled;
  }

  const wanted = statesForMode(order.mode);
  if (!wanted.includes(state)) {
    throw new Error(`a ${order.mode} order never reaches ${state}`);
  }

  let current = order;
  // Bounded by the state list rather than while(true): a machine that stops
  // advancing should fail as "never reached ready", not hang the suite.
  for (let step = 0; step < wanted.length && current.status !== state; step += 1) {
    const moved = advanceOrder(current.id);
    if (!moved) throw new Error(`${current.orderNumber} stopped at ${current.status}`);
    current = moved;
  }

  if (current.status !== state) throw new Error(`${current.orderNumber} never reached ${state}`);
  return current;
}

// ---------------------------------------------------------------------------
// The console
// ---------------------------------------------------------------------------

/** Signs in through the real route and returns a Cookie header for later calls. */
export async function operatorCookie(): Promise<string> {
  const response = await signInRoute(
    request('/api/admin/session', { body: { passphrase: CONSOLE_PASSPHRASE } }),
  );
  expect(response.status).toBe(200);
  const value = response.headers.get('set-cookie')?.split(';')[0]?.split('=').slice(1).join('=');
  return `${SESSION_COOKIE}=${value ?? ''}`;
}

/**
 * Switches the console on and signs an operator in, for the duration of a block.
 *
 * The console fails closed without `BBQ_ADMIN_PASSWORD` — it answers 503 rather
 * than 401, because an unconfigured console is a deployment problem and not a
 * wrong password. Three suites had each worked that out and set the variable in
 * their own `beforeEach`, and a fourth spent a test run discovering it again.
 *
 * The cookie is handed to the block rather than stored, so nothing outside the
 * block can use a session the environment no longer supports.
 */
/**
 * The same switch for suites that sign in once in `beforeEach`.
 *
 * `withConsole` wraps a block; these two are for the suites built the other way
 * round, where the cookie is obtained once and every test uses it. Four suites
 * had written both lines out.
 */
export function enableConsole(): void {
  process.env.BBQ_ADMIN_PASSWORD = CONSOLE_PASSPHRASE;
}

export function disableConsole(): void {
  delete process.env.BBQ_ADMIN_PASSWORD;
}

export async function withConsole<T>(run: (cookie: string) => T | Promise<T>): Promise<T> {
  const before = process.env.BBQ_ADMIN_PASSWORD;
  process.env.BBQ_ADMIN_PASSWORD = CONSOLE_PASSPHRASE;
  try {
    return await run(await operatorCookie());
  } finally {
    if (before === undefined) delete process.env.BBQ_ADMIN_PASSWORD;
    else process.env.BBQ_ADMIN_PASSWORD = before;
  }
}

/**
 * Builds console requests that carry an operator's cookie.
 *
 * Curried on the cookie because the cookie is obtained in `beforeEach` and the
 * requests are built inside the tests — two suites had each closed over a
 * mutable `let cookie` to bridge that gap, which works until a test forgets to
 * await the sign-in and reads an empty string.
 */
export function asOperator(cookie: string) {
  return (url: string, body?: unknown): Request => request(url, { body, cookie });
}

// ---------------------------------------------------------------------------
// Standing in for the network
// ---------------------------------------------------------------------------

export type StubbedResponse = { status?: number; body: unknown };

/**
 * An order shaped the way the API really answers, for the suites that stand in
 * for the network.
 *
 * There were two of these, one per suite, and they had already drifted: one
 * described a received collection order and the other a completed one on an
 * account, and neither could be used by the other test. Worse, both had at one
 * point been missing the payment half of the response — which the schema now
 * refuses, but only after the schema was written. One shape, overridable.
 *
 * Built off the real seed product so the totals are a price the catalogue
 * actually charges rather than a round number that no order could have.
 */
export function anApiOrder(over: Record<string, unknown> = {}): Record<string, unknown> {
  const product = aProduct();
  return {
    id: 'O-1',
    orderNumber: 'BBQ-260902-0001',
    storeId: aCollectionStore().id,
    mode: 'Collection',
    status: 'received',
    customer,
    accountId: null,
    cancelledReason: null,
    placedAt: new Date().toISOString(),
    etaMinutes: 25,
    lines: [orderLine(product)],
    totals: {
      subtotalCents: product.priceCents,
      discountCents: 0,
      deliveryCents: 0,
      totalCents: product.priceCents,
    },
    promoCode: null,
    address: null,
    suburb: null,
    // On the real Order and missing from one of the two copies this replaces.
    // A stub narrower than the response it stands in for is a test that passes
    // against a shape the API does not send.
    postalCode: null,
    kitchenNote: '',
    pointsEarned: Math.floor(product.priceCents / 100),
    ...over,
  };
}

/**
 * The journey response, whole.
 *
 * The payment half is not optional in the schema, so a fixture that leaves it
 * out is a fixture that no longer describes the API — which is what two of
 * these were until the schema said so.
 */
export function anApiOrderStatus(
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    order: anApiOrder(),
    statusLabel: 'Order received',
    payment: { required: false, status: null },
    ...over,
  };
}

/** A saved address as the API answers it. */
export function anApiAddress(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { id: 'adr_1', label: 'Home', address: '12 Oak Avenue', suburb: 'Sandton', note: '', ...over };
}

/** An account as the API answers it. */
export function anApiAccount(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'acc_1',
    name: customer.name,
    email: customer.email,
    mobile: customer.mobile,
    createdAt: new Date().toISOString(),
    points: 40,
    ...over,
  };
}

/**
 * Replaces `fetch` for the browser-side service layer.
 *
 * `client-api` is the layer that parses every response through its schema so a
 * shape the API did not promise fails there rather than three components
 * later. Testing that means handing it shapes on purpose, which means standing
 * in for the network rather than reaching it.
 *
 * Returns a restore function; call it in `afterEach` so one suite's stub
 * cannot leak into the next.
 */
export function stubFetch(
  reply: (path: string, init?: RequestInit) => StubbedResponse,
): () => void {
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = typeof input === 'string' ? input : input.toString();
    const { status = 200, body } = reply(path, init);
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;

  return () => {
    globalThis.fetch = original;
  };
}

/**
 * `stubFetch` for a suite that keeps its restore function in a variable.
 *
 * Two suites had written the same three-line wrapper because `stubFetch`
 * returns the restore rather than registering it. This holds the restore itself
 * and hands back one to call in `afterEach`, so a suite has one thing to
 * remember instead of two.
 */
export function fetchStub(): {
  serve: (reply: (path: string, init?: RequestInit) => StubbedResponse) => void;
  restore: () => void;
} {
  let undo: (() => void) | null = null;
  return {
    serve: (reply) => {
      undo?.();
      undo = stubFetch(reply);
    },
    restore: () => {
      undo?.();
      undo = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Resetting between tests
// ---------------------------------------------------------------------------

/**
 * Puts the shared state back where a fresh deployment starts.
 *
 * Deliberately leaves the orders, the counter and the audit log alone: a suite
 * that places an order and then reads it back wants both halves to survive the
 * next `beforeEach`. `blankState` is the one that clears everything.
 */
export function resetState(): void {
  mutateState((state) => {
    state.soldOut = [];
    state.hidden = [];
    state.services = {};
    state.consoleLock = { failures: 0, lockedUntil: null };
  });
}

/**
 * Everything `resetState` clears, plus the orders, the order counter and the
 * audit log.
 *
 * The order suite had been writing the second half itself, inline in its own
 * `beforeEach`, which is a fixture in everything but name — and one the audit
 * tests then needed too, at which point there would have been two of them
 * disagreeing about what "empty" means.
 */
export function blankState(): void {
  resetState();
  mutateState((state) => {
    state.orders = [];
    state.sequence = 0;
    state.audit = [];
    state.payments = { intents: [], appliedEvents: [] };
    state.accounts = [];
    state.notifications = { sent: [], webhookTokens: [] };
    state.suppressed = [];
    state.fulfilment = { handoffs: [], inFlight: [] };
    state.passwordResets = [];
  });
}

// ---------------------------------------------------------------------------
// Customer accounts
// ---------------------------------------------------------------------------

/** Long enough for the session module to accept it as a secret. */
export const SESSION_SECRET = 'a-test-session-secret-long-enough';

/**
 * The password every account fixture uses.
 *
 * A constant because four suites had the literal written out sixteen times
 * between them — registering with it, signing in with it, and asserting that a
 * response never contains it. A test that changes one of those and not the
 * others fails in a way that looks like a bug in the password rules.
 */
export const PASSWORD = 'a-long-enough-password';

/** A registration body that passes every rule, with anything overridden. */
export function registration(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...customer, password: PASSWORD, ...over };
}

/**
 * Switches customer accounts on for the duration of a block.
 *
 * Accounts fail closed without a secret, so almost every test here needs this;
 * the ones that do not are the ones checking that it fails closed.
 */
export async function withAccounts<T>(run: () => T | Promise<T>): Promise<T> {
  const before = process.env.BBQ_SESSION_SECRET;
  process.env.BBQ_SESSION_SECRET = SESSION_SECRET;
  try {
    return await run();
  } finally {
    if (before === undefined) delete process.env.BBQ_SESSION_SECRET;
    else process.env.BBQ_SESSION_SECRET = before;
  }
}

/**
 * Registers a customer through the real route and returns their id and cookie.
 *
 * Through the route rather than the store, so a test reading an account is
 * reading one the API created — including the session it was handed, which is
 * the thing most of these tests are really about.
 */
export async function registerCustomer(
  over: Record<string, unknown> = {},
): Promise<{ id: string; cookie: string }> {
  const { POST } = await import('@/app/api/account/route');
  const response = await POST(request('/api/account', { body: registration(over) }));
  expect(response.status, await response.clone().text()).toBe(201);

  const { account } = await bodyOf<{ account: { id: string } }>(response);
  return { id: account.id, cookie: cookieFrom(response, CUSTOMER_COOKIE) };
}

/**
 * The value out of a Set-Cookie header, without the attributes after it.
 *
 * Split on `=` and rejoined past the first, because a signed cookie's value
 * contains `=` of its own — base64 padding — and taking `[1]` truncates it to
 * something that looks like a cookie and verifies as nothing.
 */
export function cookieValue(setCookie: string | null): string {
  return setCookie?.split(';')[0]?.split('=').slice(1).join('=') ?? '';
}

/** Pulls one cookie out of a response, as a Cookie header for the next call. */
export function cookieFrom(response: Response, name: string): string {
  return `${name}=${cookieValue(response.headers.get('set-cookie'))}`;
}

// ---------------------------------------------------------------------------
// Where things are on disk
// ---------------------------------------------------------------------------

/** The app. Several suites had each worked this path out from `__dirname`. */
export const WEB = path.resolve(__dirname, '..');

/** The monorepo root, for the suites that read seeds, assets or infra. */
export const REPO = path.resolve(WEB, '../..');

/**
 * Every file under a directory, recursively.
 *
 * There were three of these — one per suite that needed to walk a tree — and
 * they did not agree: two skipped `node_modules` and `.next`, one did not, and
 * that one only worked because it was pointed at a directory with neither. A
 * walk that is correct by where you aim it is a walk that breaks when somebody
 * aims it somewhere else.
 */
export function filesUnder(directory: string, match?: RegExp): string[] {
  const walk = (at: string): string[] => {
    if (!statSync(at).isDirectory()) return [at];
    return readdirSync(at).flatMap((entry) => {
      if (entry === 'node_modules' || entry === '.next' || entry === '.git') return [];
      return walk(path.join(at, entry));
    });
  };
  const found = walk(directory);
  return match ? found.filter((file) => match.test(file)) : found;
}

/** Every source file that could read an environment variable or a token. */
export function sourceFiles(): string[] {
  return [path.join(WEB, 'src'), path.join(REPO, 'infra'), path.join(REPO, 'packages')].flatMap(
    (root) => filesUnder(root, /\.(ts|tsx|mjs)$/),
  );
}

/**
 * Every route handler in the app, as the path a caller would use.
 *
 * Derived from the files rather than listed, so a route added without a line in
 * the README fails the documentation test rather than passing unnoticed.
 */
export function apiRoutesOnDisk(): string[] {
  const base = path.join(WEB, 'src/app/api');
  return filesUnder(base, /(^|[/\\])route\.ts$/).map((file) => {
    // The directory holding route.ts, relative to api/, as URL segments. A
    // handler sitting directly in api/ has none, so `.` becomes nothing rather
    // than a literal dot in the path.
    const within = path.dirname(path.relative(base, file));
    const segments = within === '.' ? [] : within.split(path.sep);
    return ['/api', ...segments].join('/');
  });
}

/**
 * Every exported handler in a route file, with its body.
 *
 * Split per handler rather than per file, because a file is the wrong unit for
 * asking whether something is guarded: a route exporting GET, POST and DELETE
 * that calls the guard once contains the string and protects one verb.
 *
 * The split is on the export keyword, which is exact here because these files
 * are written one handler after another with nothing between them — and if that
 * ever stops being true, the count of handlers changes and the test that reads
 * this fails rather than quietly checking fewer things.
 */
export function routeHandlers(relativePath: string): { verb: string; body: string }[] {
  const source = webFile(relativePath);
  const pattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

  const starts = [...source.matchAll(pattern)].map((match) => ({
    verb: match[1] as string,
    at: match.index ?? 0,
  }));

  return starts.map((start, index) => ({
    verb: start.verb,
    body: source.slice(start.at, starts[index + 1]?.at ?? source.length),
  }));
}

/** The single-file review build's template, read by two suites. */
export function demoTemplate(): string {
  return readFileSync(path.join(WEB, 'static-demo/index.template.html'), 'utf8');
}

/**
 * A file under the app, by its path from the app root.
 *
 * Eleven suites read source files to check something the type system cannot —
 * that a component asks for a postal code, that the Dockerfile copies what it
 * builds — and each resolved `../` from `__dirname` itself. Nineteen of those,
 * all one directory hop from being wrong the day a suite moves into a
 * subfolder.
 */
export function webFile(relativePath: string): string {
  return readFileSync(path.join(WEB, relativePath), 'utf8');
}

/**
 * The generated review build, or null when it has not been built.
 *
 * Null rather than a throw, and null rather than an empty string: the file is
 * generated and not committed, so a suite that checks it has to be able to say
 * "not built here" and skip. Two tests had each written that `existsSync` guard
 * and the comment explaining it.
 */
export function builtDemoPage(): string | null {
  const built = path.join(WEB, 'static-demo/bbq-chicken-website.html');
  return existsSync(built) ? readFileSync(built, 'utf8') : null;
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

/**
 * The sandbox gateway's shared secret, for tests that sign a callback.
 *
 * A literal rather than a random value: a signature test whose secret changes
 * per run cannot be told apart from a signature test that is simply broken.
 */
export const PAYMENT_SECRET = 'sandbox-signing-secret';

/**
 * Switches the sandbox provider on for the duration of a block.
 *
 * Both variables or neither — the registry treats a named provider with no
 * secret as no provider at all, and a test that sets only one is testing that
 * rule rather than the one it meant to.
 */
function setEnv(key: 'BBQ_PAYMENT_PROVIDER' | 'BBQ_PAYMENT_SECRET', value?: string): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

async function withPaymentEnv<T>(
  name: string | undefined,
  secret: string | undefined,
  run: () => T | Promise<T>,
): Promise<T> {
  const before = {
    name: process.env.BBQ_PAYMENT_PROVIDER,
    secret: process.env.BBQ_PAYMENT_SECRET,
  };

  setEnv('BBQ_PAYMENT_PROVIDER', name);
  setEnv('BBQ_PAYMENT_SECRET', secret);

  try {
    return await run();
  } finally {
    setEnv('BBQ_PAYMENT_PROVIDER', before.name);
    setEnv('BBQ_PAYMENT_SECRET', before.secret);
  }
}

export async function withPaymentProvider<T>(
  run: () => T | Promise<T>,
  config: { name?: string; secret?: string } = {},
): Promise<T> {
  return withPaymentEnv(config.name ?? 'sandbox', config.secret ?? PAYMENT_SECRET, run);
}

/**
 * The state this deployment is actually in.
 *
 * A separate helper rather than `withPaymentProvider({ name: undefined })`,
 * because an options object cannot tell "leave it out" from "I did not say" —
 * the `??` default would quietly switch the provider back on and the test would
 * pass for the wrong reason.
 */
export async function withoutPaymentProvider<T>(run: () => T | Promise<T>): Promise<T> {
  return withPaymentEnv(undefined, undefined, run);
}

/**
 * PayFast, configured the way a deployment would be.
 *
 * Its own helper because the PayFast branch of the registry needs four more
 * variables than the sandbox does, and a test that sets two of them gets `null`
 * back and then passes for the wrong reason — the registry refusing to build a
 * half-configured provider, which is correct, rather than the thing under test.
 *
 * `BBQ_PUBLIC_URL` matters most here: it is what the per-order return and
 * cancel URLs are built from, so without it the adapter falls back to the
 * deployment-wide ones and the test would be checking the fallback.
 */
export async function withPayfast<T>(
  run: () => T | Promise<T>,
  publicUrl = 'https://order.example.test',
): Promise<T> {
  const extra = {
    BBQ_PAYFAST_MERCHANT_ID: '10000100',
    BBQ_PAYFAST_MERCHANT_KEY: '46f0cd694581a',
    BBQ_PAYFAST_SANDBOX: 'true',
    BBQ_PUBLIC_URL: publicUrl,
  } as const;

  const before = Object.fromEntries(
    Object.keys(extra).map((key) => [key, process.env[key]]),
  ) as Record<string, string | undefined>;

  for (const [key, value] of Object.entries(extra)) process.env[key] = value;

  try {
    return await withPaymentEnv('payfast', PAYMENT_SECRET, run);
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

/**
 * The sandbox, told to refuse refunds for the duration of a block.
 *
 * The failure paths are the ones worth rehearsing and the ones a happy-path
 * sandbox never reaches — a gateway that declines is not an exotic case, it is
 * a Tuesday. Every real gateway's sandbox offers this; ours does too, and this
 * is the switch.
 */
export async function withRefusedRefunds<T>(run: () => T | Promise<T>): Promise<T> {
  const before = process.env.BBQ_SANDBOX_REFUSE_REFUND;
  process.env.BBQ_SANDBOX_REFUSE_REFUND = 'true';
  try {
    return await run();
  } finally {
    if (before === undefined) delete process.env.BBQ_SANDBOX_REFUSE_REFUND;
    else process.env.BBQ_SANDBOX_REFUSE_REFUND = before;
  }
}

/**
 * A callback signed the way the sandbox provider signs, so a test drives the
 * real verification rather than reaching past it.
 */
export function signedWebhook(event: Record<string, unknown>, secret = PAYMENT_SECRET): Request {
  const rawBody = JSON.stringify(event);
  return new Request('http://localhost/api/payments/webhook', {
    method: 'POST',
    headers: { [SANDBOX_SIGNATURE_HEADER]: signBody(rawBody, secret) },
    body: rawBody,
  });
}

/**
 * Opens a payment for an order the way the checkout screen does.
 *
 * Through the route rather than the ledger, so a test that needs an open intent
 * as a precondition gets one the API actually created — including the refusal
 * when no gateway is configured, which is the thing several of these suites are
 * really about.
 */
export async function openIntentFor(orderId: string): Promise<Response> {
  const { POST } = await import('@/app/api/payments/intent/route');
  return POST(request('/api/payments/intent', { body: { orderId } }));
}

/**
 * Opens a payment and settles it, as a gateway callback would.
 *
 * Throws by name when there is no intent. The alternative is a non-null
 * assertion, which turns "the intent was never opened" — usually because the
 * caller forgot `withPaymentProvider` — into an unrelated failure two lines
 * later, in a test that looks like it is about something else.
 *
 * The amount is read off the intent rather than passed in: the ledger refuses
 * an event whose amount disagrees with what was asked for, so a fixture that
 * invented one would be testing that refusal by accident.
 */
export async function settlePayment(
  orderId: string,
  status: 'captured' | 'failed' = 'captured',
): Promise<PaymentIntent> {
  await openIntentFor(orderId);
  const intent = intentForOrder(orderId);
  if (!intent) throw new Error(`No intent was opened for ${orderId}`);

  const result = settle({
    id: `evt_${status}_${intent.id}`,
    intentId: intent.id,
    status,
    providerRef: 'pf_1',
    amountCents: intent.amountCents,
    failureReason: status === 'failed' ? 'The gateway reported FAILED' : null,
  });

  if (!result.ok) throw new Error(`settling ${intent.id} failed: ${result.error}`);
  return result.intent;
}

/**
 * An order that has been paid for, with the gateway switched on around it.
 *
 * The precondition for everything downstream of money: the kitchen may start,
 * the console shows it as paid, the journey screen stops asking for payment.
 * Written as one call because the three steps have to happen inside the same
 * provider block — an intent opened with a gateway configured and settled
 * without one is a state no deployment can reach.
 */
export async function aPaidOrder(over: Record<string, unknown> = {}): Promise<Order> {
  return withPaymentProvider(async () => {
    const order = await placeOrder(over);
    await settlePayment(order.id, 'captured');
    return order;
  });
}

/**
 * An order paid for and then sent back — the state a cancelled paid order ends
 * in, and the one nothing could reach until the refund path was built.
 *
 * The whole sequence happens inside one provider block, like `aPaidOrder`: an
 * intent opened with a gateway configured and refunded without one is a state
 * no deployment can be in.
 */
export async function aRefundedOrder(over: Record<string, unknown> = {}): Promise<Order> {
  const { refundPayment } = await import('@/lib/payments/ledger');
  return withPaymentProvider(async () => {
    const order = await placeOrder(over);
    await settlePayment(order.id, 'captured');
    const result = await refundPayment(order.id, 'Refunded by a fixture');
    if (!result.ok) throw new Error(`refunding ${order.orderNumber} failed: ${result.error}`);
    return order;
  });
}

/** A callback carrying a signature that is merely plausible. */
export function forgedWebhook(event: Record<string, unknown>): Request {
  const rawBody = JSON.stringify(event);
  return new Request('http://localhost/api/payments/webhook', {
    method: 'POST',
    headers: { [SANDBOX_SIGNATURE_HEADER]: 'f'.repeat(64) },
    body: rawBody,
  });
}

/** Where the shared state is being kept for this test file. */
export function stateFile(): string {
  const file = process.env.BBQ_STATE_FILE;
  if (!file) throw new Error('BBQ_STATE_FILE is unset; tests/setup.ts should have set it');
  return file;
}

/**
 * Writes bytes straight into the state file, past everything that normally
 * guards it.
 *
 * The persistence layer has to survive a file it did not write — truncated by a
 * full disk, left behind by an older shape, hand-edited by somebody debugging.
 * There is no way to reach that path through the module's own API, which is
 * exactly why it was never covered.
 */
export function writeRawState(contents: string): void {
  writeFileSync(stateFile(), contents, 'utf8');
}

/**
 * Runs a block against a state file of its own, then puts the environment back.
 *
 * `BBQ_STATE_FILE` is read on every call rather than captured at import, so a
 * test can move the file mid-run — which is the only way to prove that property
 * holds, and the only safe way to point the module at a path it cannot write.
 */
export async function withStateFile<T>(run: (file: string) => T | Promise<T>): Promise<T> {
  const previous = process.env.BBQ_STATE_FILE;
  const file = path.join(os.tmpdir(), `bbq-fixture-state-${randomBytes(8).toString('hex')}.json`);
  process.env.BBQ_STATE_FILE = file;

  try {
    return await run(file);
  } finally {
    if (previous === undefined) delete process.env.BBQ_STATE_FILE;
    else process.env.BBQ_STATE_FILE = previous;
    rmSync(file, { force: true });
  }
}

// ---------------------------------------------------------------------------
// The two order endpoints a stranger can reach

/**
 * GET /api/orders/:id through the real handler.
 *
 * The privacy suite asks the same question of both order endpoints, and the
 * question is about what comes back rather than about how it was asked. Driving
 * the route rather than calling `readOrder` is the whole point: the narrowing
 * happens in the handler, so a helper that skipped it would test nothing.
 */
export async function fetchOrderPublicly(id: string): Promise<Response> {
  const { GET } = await import('@/app/api/orders/[id]/route');
  return GET(request(`/api/orders/${id}`), params({ id }));
}

/** POST /api/orders/:id/advance through the real handler. */
export async function advancePublicly(id: string): Promise<Response> {
  const { POST } = await import('@/app/api/orders/[id]/advance/route');
  return POST(request(`/api/orders/${id}/advance`, { method: 'POST' }), params({ id }));
}

/**
 * Everything about an order that identifies the person who placed it.
 *
 * Written as the values rather than the field names on purpose. A test that
 * checks field names asks "is `customer` absent", and passes the moment
 * somebody spreads the customer's details into the top level or folds an email
 * address into a label. This asks whether the string `thandi@example.com`
 * appears anywhere in the response at all, which has no such gap.
 *
 * The suburb is deliberately absent: it is a delivery area the site publishes
 * on its own stores page, so finding it in a response says nothing about a
 * customer. Including it would fail every delivery test for a value the
 * business prints on the website.
 *
 * So is the postal code, for a different reason. Four digits are too short to
 * search for in a body of text: `2196` is a real postal code and also the
 * middle of `R219.60`, so a test looking for it would one day fail on an
 * amount and send somebody hunting for a leak that was a price. It is checked
 * by name instead, in both suites that care, where there is no ambiguity about
 * which field is being read.
 */
export function personalDetailsOf(order: Order): string[] {
  return [
    order.customer.name,
    order.customer.email,
    order.customer.mobile,
    order.address,
    order.accountId,
  ].filter((value): value is string => typeof value === 'string' && value.length > 0);
}

/**
 * The field names a Zod object schema carries.
 *
 * Used to hold the public view and the full order against each other, so a
 * field added to one is a decision about the other rather than an oversight.
 */
export function fieldsOf(schema: { shape: Record<string, unknown> }): string[] {
  return Object.keys(schema.shape).sort();
}

// ---------------------------------------------------------------------------
// Erasure, and proving it reached everywhere

/**
 * A delivery order placed by a signed-in customer, through the real route.
 *
 * The combination that matters and that nothing built: `placeOrderAs` gives an
 * order with an account behind it but no address, and `placeDeliveryOrder`
 * gives an address with no account. Erasure only has something to erase where
 * both are true, and the existing suite's erasure test used a collection order
 * — so the address it should have been clearing was never on the record it
 * looked at.
 */
export async function placeDeliveryOrderAs(
  cookie: string,
  over: Record<string, unknown> = {},
): Promise<Order> {
  const response = await createOrderRoute(
    request('/api/orders', { cookie, body: deliveryRequest(over) }),
  );
  expect(response.status, await response.clone().text()).toBe(201);
  return (await bodyOf<{ order: Order }>(response)).order;
}

/** Erases the signed-in customer through the real route. */
export async function eraseAccountVia(cookie: string): Promise<Response> {
  const { DELETE } = await import('@/app/api/account/privacy/route');
  return DELETE(request('/api/account/privacy', { cookie, method: 'DELETE' }));
}

/**
 * Everything the server has written down, as one string to search.
 *
 * The point is to ask "is this person's mobile number anywhere at all" rather
 * than "is it in the field I remembered to check". The erasure test that
 * shipped asserted one field on one order and passed while the street address
 * sat two properties away.
 */
export function persistedState(): string {
  return JSON.stringify(readState());
}

// ---------------------------------------------------------------------------
// The edges of the arithmetic

/**
 * Places an order through the real route and hands back the raw response.
 *
 * `placeOrder` asserts a 201 before returning, which is right for the eighty
 * suites that need an order to look at and useless for the ones asking whether
 * the route refuses. Those had each built the request-and-response pair by hand
 * to get at a 400.
 */
export async function attemptOrder(
  lines: OrderLine[],
  over: Record<string, unknown> = {},
): Promise<Response> {
  return createOrderRoute(request('/api/orders', { body: orderRequest(lines, over) }));
}

/**
 * `count` distinct basket lines that the route will actually accept.
 *
 * Distinct because a line is keyed by its product and its options, so `count`
 * copies of one line is one line with a quantity — which is the other limit,
 * and not the one a caller asking for fifty lines is testing.
 *
 * Every candidate is put through the real repricer and only kept if it comes
 * back clean, which is the point. The first version of this invented an option
 * group, and the repricer rightly refused every line: the test read as "a
 * fifty-line basket is rejected" when what was rejected was the fixture. A
 * fixture used to prove a limit must not be capable of failing for any other
 * reason, so this one cannot hand back a line the route would turn down.
 *
 * Throws rather than returning a short list, for the same reason — a caller
 * asking for fifty and quietly getting nine tests the wrong number.
 */
export function distinctLines(count: number): OrderLine[] {
  const candidates: OrderLine[] = [];

  for (const product of PRODUCTS) {
    candidates.push(orderLine(product));

    // Varied by a real choice from a real group, so the same product can
    // supply several lines once the catalogue runs out of products.
    for (const group of optionGroupsFor(product)) {
      for (const choice of group.choices) {
        candidates.push(
          orderLine(product, {
            key: `${product.slug}::${group.key}:${choice.label}`,
            unitCents: product.priceCents + choice.deltaCents,
            options: [{ groupKey: group.key, groupLabel: group.label, choices: [choice.label] }],
          }),
        );
      }
    }
  }

  const usable: OrderLine[] = [];
  const seen = new Set<string>();
  for (const line of candidates) {
    if (usable.length === count) break;
    if (seen.has(line.key)) continue;
    if (!repriceLines([line]).ok) continue;
    seen.add(line.key);
    usable.push(line);
  }

  if (usable.length < count) {
    throw new Error(
      `the seed catalogue yields only ${usable.length} valid distinct lines, not ${count}`,
    );
  }
  return usable;
}

/**
 * The dearest single line the catalogue can produce, at a given quantity.
 *
 * For the tests that ask whether the totals stay exact at the top of the range.
 * Reading the most expensive product rather than naming one keeps the bound
 * honest when the menu changes.
 */
export function dearestLine(quantity: number): OrderLine {
  const dearest = PRODUCTS.reduce((most, candidate) =>
    candidate.priceCents > most.priceCents ? candidate : most,
  );
  return { ...orderLine(dearest), quantity };
}
