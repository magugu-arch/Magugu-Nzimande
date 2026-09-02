import { PRODUCTS, STORES, optionGroupsFor } from '@bbq/seed';
import type { OptionGroup, OrderLine, Product, Store } from '@bbq/types';
import { expect } from 'vitest';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { POST as signInRoute } from '@/app/api/admin/session/route';
import { SESSION_COOKIE } from '@/lib/admin-auth';
import { mutateState } from '@/lib/demo-state';

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

/** Throws rather than returning undefined: a missing fixture is a broken test. */
function required<T>(value: T | undefined, what: string): T {
  if (value === undefined) throw new Error(`the seed catalogue has no ${what} to test with`);
  return value;
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

/** Minutes since midnight, for readable trading-hour fixtures. */
export const at = (hour: number, minute = 0): number => hour * 60 + minute;

/** A UTC instant for a given SAST wall-clock time. SAST is UTC+2, no DST. */
export function sast(isoDate: string, hour: number, minute = 0): Date {
  const utcHour = hour - 2;
  const day = new Date(`${isoDate}T00:00:00Z`);
  day.setUTCMinutes(utcHour * 60 + minute);
  return day;
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

/** A complete, valid create-order body, with anything overridden. */
export function orderRequest(
  lines: OrderLine[],
  over: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    storeId: aCollectionStore().id,
    mode: 'Collection',
    customer,
    lines,
    promoCode: null,
    kitchenNote: '',
    ...over,
  };
}

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

// ---------------------------------------------------------------------------
// Placing a real order, for the suites that need one to look at
// ---------------------------------------------------------------------------

/**
 * Places an order through the real route and returns it, so a journey test is
 * reading an order the API actually created rather than one it invented and
 * pushed into the store behind the API's back.
 */
export async function placeOrder(over: Record<string, unknown> = {}) {
  const product = aProduct();
  const response = await createOrderRoute(
    request('/api/orders', { body: orderRequest([orderLine(product)], over) }),
  );
  expect(response.status).toBe(201);
  const { order } = await bodyOf<{ order: { id: string; status: string; mode: string } }>(
    response,
  );
  return order;
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

// ---------------------------------------------------------------------------
// Standing in for the network
// ---------------------------------------------------------------------------

export type StubbedResponse = { status?: number; body: unknown };

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

// ---------------------------------------------------------------------------
// Resetting between tests
// ---------------------------------------------------------------------------

/** Puts the shared state back where a fresh deployment starts. */
export function resetState(): void {
  mutateState((state) => {
    state.soldOut = [];
    state.hidden = [];
    state.services = {};
    state.consoleLock = { failures: 0, lockedUntil: null };
  });
}
