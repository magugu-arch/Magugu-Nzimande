import {
  DeliveryQuoteSchema,
  OrderSchema,
  z,
  type CreateOrderRequest,
  type DeliveryQuote,
  type Order,
} from '@bbq/types';

/**
 * The service layer, browser side. Same endpoints as lib/api.ts, reached over
 * HTTP. Every response is parsed through its schema — a shape the API did not
 * promise fails here rather than three components later.
 */

class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request<T>(
  path: string,
  schema: z.ZodType<T>,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Something went wrong. Please try again.';
    throw new ApiError(message, response.status);
  }

  return schema.parse(body);
}

export { ApiError };

/** POST /api/delivery/quote */
export async function quoteDelivery(
  suburb: string,
  subtotalCents: number,
): Promise<DeliveryQuote> {
  const { quote } = await request(
    '/api/delivery/quote',
    z.object({ quote: DeliveryQuoteSchema }),
    { method: 'POST', body: JSON.stringify({ suburb, subtotalCents }) },
  );
  return quote;
}

/** POST /api/orders */
export async function placeOrder(payload: CreateOrderRequest): Promise<Order> {
  const { order } = await request('/api/orders', z.object({ order: OrderSchema }), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return order;
}

/** GET /api/orders/:id */
export async function fetchOrder(id: string): Promise<{ order: Order; statusLabel: string }> {
  return request(
    `/api/orders/${encodeURIComponent(id)}`,
    z.object({ order: OrderSchema, statusLabel: z.string() }),
  );
}
