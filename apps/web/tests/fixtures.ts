import { randomBytes } from 'node:crypto';
import { rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PRODUCTS, STORES, optionGroupsFor } from '@bbq/seed';
import type { OptionGroup, Order, OrderLine, Product, ServiceMode, Store } from '@bbq/types';
import { expect } from 'vitest';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { POST as signInRoute } from '@/app/api/admin/session/route';
import { CUSTOMER_COOKIE } from '@/lib/accounts/session';
import { SESSION_COOKIE } from '@/lib/admin-auth';
import { mutateState } from '@/lib/demo-state';
import { signBody } from '@/lib/payments/provider';
import { SANDBOX_SIGNATURE_HEADER } from '@/lib/payments/sandbox-provider';

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
    state.notifications = { sent: [] };
    state.fulfilment = { handoffs: [] };
    state.passwordResets = [];
  });
}

// ---------------------------------------------------------------------------
// Customer accounts
// ---------------------------------------------------------------------------

/** Long enough for the session module to accept it as a secret. */
export const SESSION_SECRET = 'a-test-session-secret-long-enough';

/** A registration body that passes every rule, with anything overridden. */
export function registration(over: Record<string, unknown> = {}): Record<string, unknown> {
  return { ...customer, password: 'a-long-enough-password', ...over };
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

/** Pulls one cookie's value out of a response's Set-Cookie header. */
export function cookieFrom(response: Response, name: string): string {
  const header = response.headers.get('set-cookie') ?? '';
  const value = header.split(';')[0]?.split('=').slice(1).join('=') ?? '';
  return `${name}=${value}`;
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
