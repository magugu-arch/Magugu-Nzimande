import {
  DeliveryQuoteSchema,
  OrderLineSchema,
  OrderPaymentSchema,
  OrderSchema,
  PaymentIntentSchema,
  PublicOrderSchema,
  z,
  type CreateOrderRequest,
  type DeliveryQuote,
  type Order,
  type OrderLine,
  type OrderPayment,
  type PublicOrder,
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

/**
 * Both order endpoints answer with the narrowed view, so this parses it.
 *
 * Parsing against `PublicOrderSchema` rather than `OrderSchema` is not
 * cosmetic: the full schema requires a customer, an address and the rest, so
 * had it stayed here it would have rejected the very responses the fix
 * produces — the browser would have thrown on every poll. The schema the client
 * expects and the shape the server sends are one decision.
 */
const OrderStatusResponse = z.object({
  order: PublicOrderSchema,
  statusLabel: z.string(),
  payment: OrderPaymentSchema,
});

export type OrderStatus = { order: PublicOrder; statusLabel: string; payment: OrderPayment };

/** GET /api/orders/:id */
export async function fetchOrder(id: string): Promise<OrderStatus> {
  return request(`/api/orders/${encodeURIComponent(id)}`, OrderStatusResponse);
}

/** POST /api/orders/:id/advance */
export async function advanceOrder(id: string): Promise<OrderStatus> {
  return request(`/api/orders/${encodeURIComponent(id)}/advance`, OrderStatusResponse, {
    method: 'POST',
  });
}

/**
 * POST /api/basket/reprice — what a basket built earlier is worth now.
 *
 * Used by the two reorder buttons before anything reaches the basket. The
 * server owns the pricing rule; this parses what it says and nothing more,
 * because a browser that works out its own option deltas is a browser that will
 * one day work out a different number from the till.
 */
const RepricedResponse = z.object({
  lines: z.array(OrderLineSchema),
  repriced: z.array(
    z.object({
      slug: z.string(),
      name: z.string(),
      wasCents: z.number().int(),
      nowCents: z.number().int(),
    }),
  ),
  dropped: z.array(z.object({ slug: z.string(), name: z.string(), problem: z.string() })),
});

export type RepricedBasket = z.infer<typeof RepricedResponse>;

export async function repriceBasket(lines: OrderLine[]): Promise<RepricedBasket> {
  return request('/api/basket/reprice', RepricedResponse, {
    method: 'POST',
    body: JSON.stringify({ lines }),
  });
}

/**
 * POST /api/payments/intent — open a payment against an order just placed.
 *
 * `redirectUrl` is where the customer has to be sent to actually pay. It is
 * null for a gateway that takes the money without leaving the site, so a caller
 * has to handle both rather than assume a redirect.
 *
 * Throws ApiError with status 501 when this deployment has no gateway
 * configured. That refusal is the designed answer, not a fault: the caller is
 * expected to carry on with an unpaid order rather than to treat it as a
 * failure, which is what makes a build with no merchant account still work.
 */
export async function openPayment(
  orderId: string,
): Promise<{ intentId: string; amountCents: number; redirectUrl: string | null }> {
  const { intent, redirectUrl } = await request(
    '/api/payments/intent',
    z.object({ intent: PaymentIntentSchema, redirectUrl: z.string().nullable().default(null) }),
    { method: 'POST', body: JSON.stringify({ orderId }) },
  );
  return { intentId: intent.id, amountCents: intent.amountCents, redirectUrl };
}
