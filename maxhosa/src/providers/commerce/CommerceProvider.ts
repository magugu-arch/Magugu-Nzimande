import type {
  CartLine,
  Category,
  CheckoutOutcome,
  CheckoutSession,
  Market,
  MarketId,
  OrderSummary,
  Product,
  SizeGuide,
  Story,
} from '@/domain/types';

export type CartProblem =
  | { kind: 'unavailable'; line: CartLine }
  | { kind: 'price-changed'; line: CartLine }
  | { kind: 'removed'; line: CartLine };

export type RevalidatedCart = {
  /** Lines with the platform's current price and stock. */
  lines: { line: CartLine; product: Product }[];
  problems: CartProblem[];
};

/**
 * The commerce platform, whatever it turns out to be. The discovery audit
 * decides the real adapter (Shopify Storefront API + Checkout Kit if Shopify
 * is confirmed); until then only `MockCommerceProvider` exists and every
 * screen it feeds says "sample".
 */
export interface CommerceProvider {
  readonly id: string;
  /** True for any adapter that is not the verified production platform. */
  readonly isMock: boolean;

  listMarkets(): Promise<Market[]>;
  listCategories(): Promise<Category[]>;
  listProducts(market: MarketId): Promise<Product[]>;
  getProduct(id: string, market: MarketId): Promise<Product | null>;
  getSizeGuide(id: string): Promise<SizeGuide | null>;
  listStories(): Promise<Story[]>;

  /** Re-read price and stock for every line before checkout. */
  revalidateCart(lines: CartLine[], market: MarketId): Promise<RevalidatedCart>;

  /**
   * Hand off to the platform's own checkout. The same idempotency key always
   * yields the same session and at most one order.
   */
  startCheckout(
    lines: CartLine[],
    market: MarketId,
    idempotencyKey: string,
    /** Demo only: which outcome the presenter wants to show. */
    simulate?: CheckoutOutcome,
  ): Promise<CheckoutSession>;

  listOrders(): Promise<OrderSummary[]>;
  getOrder(id: string): Promise<OrderSummary | null>;
}
