import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CreateOrderRequestSchema } from '@bbq/types';
import { beforeEach, describe, expect, it } from 'vitest';
import { POST as createOrderRoute } from '@/app/api/orders/route';
import { dropoffAddress } from '@/lib/fulfilment/uber/address';
import { readOrder } from '@/lib/order-store';
import {
  aDeliveryStore,
  aProduct,
  aSuburbOf,
  blankState,
  bodyOf,
  orderLine,
  orderRequest,
  request,
} from './fixtures';

/**
 * The postal code, and the address it completes.
 *
 * This is the half of the courier gap that belonged here rather than to a
 * vendor. The Uber Direct adapter was written sending an empty postal code and
 * refusing to invent one, which was the right call and left an address a
 * geocoder had to guess at. Checkout collects it now.
 */

const delivery = (over: Record<string, unknown> = {}) => {
  const store = aDeliveryStore();
  return orderRequest([orderLine(aProduct())], {
    storeId: store.id,
    mode: 'Delivery',
    address: '12 Oak Avenue',
    suburb: aSuburbOf(store),
    postalCode: '2196',
    ...over,
  });
};

beforeEach(blankState);

describe('a delivery order', () => {
  it('needs a postal code', async () => {
    const parsed = CreateOrderRequestSchema.safeParse(delivery({ postalCode: undefined }));
    expect(parsed.success).toBe(false);
  });

  it('is refused by the API without one', async () => {
    const response = await createOrderRoute(
      request('/api/orders', { body: delivery({ postalCode: undefined }) }),
    );
    expect(response.status).toBe(400);
  });

  it('takes four digits and nothing else', () => {
    for (const bad of ['219', '21966', '2196a', 'abcd', '']) {
      expect(
        CreateOrderRequestSchema.safeParse(delivery({ postalCode: bad })).success,
        bad,
      ).toBe(false);
    }
    expect(CreateOrderRequestSchema.safeParse(delivery({ postalCode: '0001' })).success).toBe(true);
  });

  /**
   * Whitespace is trimmed rather than rejected, and that is the intent: a
   * customer who pastes "2196 " out of an email has entered a valid postal
   * code. My first version of the test above asserted the opposite and was
   * wrong about the code rather than finding a bug in it.
   */
  it('trims a pasted one instead of telling the customer off', () => {
    const parsed = CreateOrderRequestSchema.safeParse(delivery({ postalCode: ' 2196 ' }));
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.postalCode).toBe('2196');
  });

  it('keeps it on the order', async () => {
    const response = await createOrderRoute(request('/api/orders', { body: delivery() }));
    expect(response.status).toBe(201);

    const { order } = await bodyOf<{ order: { id: string } }>(response);
    expect(readOrder(order.id)?.postalCode).toBe('2196');
  });

  /** A collection order has no address to complete, so it needs none of this. */
  it('is not asked of a collection order', async () => {
    const response = await createOrderRoute(
      request('/api/orders', { body: orderRequest([orderLine(aProduct())]) }),
    );

    expect(response.status).toBe(201);
    const { order } = await bodyOf<{ order: { id: string } }>(response);
    expect(readOrder(order.id)?.postalCode).toBeNull();
  });
});

describe('the address a courier is given', () => {
  it('now carries the postal code rather than an empty one', async () => {
    const response = await createOrderRoute(request('/api/orders', { body: delivery() }));
    const { order } = await bodyOf<{ order: { id: string } }>(response);
    const stored = readOrder(order.id);

    expect(stored).not.toBeNull();
    expect(dropoffAddress(stored as never)?.zip_code).toBe('2196');
  });

  /**
   * Orders placed before checkout collected one still exist, and a courier can
   * still be dispatched for them — Uber geocodes the street and suburb, less
   * reliably. Sending an empty code is the honest version of not having one.
   */
  it('still builds one for an order placed before the field existed', async () => {
    const response = await createOrderRoute(request('/api/orders', { body: delivery() }));
    const { order } = await bodyOf<{ order: { id: string } }>(response);
    const stored = readOrder(order.id);
    expect(stored).not.toBeNull();

    const older = { ...(stored as NonNullable<typeof stored>), postalCode: null };
    expect(dropoffAddress(older)?.zip_code).toBe('');
    expect(dropoffAddress(older)?.city, 'and still has somewhere to go').toBeTruthy();
  });
});

describe('the checkout form', () => {
  const FLOW = readFileSync(
    path.resolve(__dirname, '../src/components/checkout/CheckoutFlow.tsx'),
    'utf8',
  );

  it('asks for it', () => {
    expect(FLOW).toContain('Postal code');
    expect(FLOW).toContain('postalCode');
  });

  /**
   * autoComplete and inputMode, so a phone offers a number pad and a browser
   * can fill it. A four-digit field that opens a full keyboard is a field
   * people mistype.
   */
  it('lets a browser and a phone help', () => {
    expect(FLOW).toContain('autoComplete="postal-code"');
    expect(FLOW).toContain('inputMode="numeric"');
  });

  it('sends it only for a delivery', () => {
    expect(FLOW).toMatch(/mode === 'Delivery' \? \{ address, suburb, postalCode/);
  });
});

describe('the container', () => {
  const DOCKERFILE = readFileSync(path.resolve(__dirname, '../Dockerfile'), 'utf8');
  const CONFIG = readFileSync(path.resolve(__dirname, '../next.config.ts'), 'utf8');

  /**
   * The Dockerfile copies `.next/standalone`, which only exists when the build
   * is told to produce it. Without this the image builds and the container
   * starts with no server in it.
   */
  it('has the standalone output it copies', () => {
    expect(DOCKERFILE).toContain('.next/standalone');
    expect(CONFIG).toMatch(/output:\s*'standalone'/);
  });

  it('does not run as root', () => {
    expect(DOCKERFILE).toMatch(/^USER bbq$/m);
  });

  /** Orders in the image's filesystem go with the container. */
  it('keeps the state file on a volume', () => {
    expect(DOCKERFILE).toMatch(/BBQ_STATE_FILE=\/var\/lib\/bbq/);
    expect(DOCKERFILE).toMatch(/^VOLUME \/var\/lib\/bbq$/m);
  });

  it('checks its own health against the endpoint that reports storage', () => {
    expect(DOCKERFILE).toContain('/api/health');
    expect(DOCKERFILE).toMatch(/HEALTHCHECK/);
  });

  /** A base image that moves under a deployment is a change with no commit. */
  it('pins its base image', () => {
    for (const from of DOCKERFILE.match(/^FROM \S+/gm) ?? []) {
      expect(from, from).not.toMatch(/:latest|^FROM node$/);
    }
  });

  it('carries no secret', () => {
    expect(DOCKERFILE).not.toMatch(/BBQ_(ADMIN_PASSWORD|SESSION_SECRET|PAYMENT_SECRET)=\S/);
    expect(DOCKERFILE).not.toMatch(/BBQ_UBER_CLIENT_SECRET=\S/);
  });
});
