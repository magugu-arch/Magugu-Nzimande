import catalogue from '@data/sample-catalogue.json';
import { assetRegistry, type AssetId } from '@/assets/registry.generated';
import type {
  CartLine,
  Category,
  CategoryId,
  CheckoutOutcome,
  CheckoutSession,
  Market,
  MarketId,
  OrderSummary,
  Product,
  SizeGuide,
  StockStatus,
  Story,
} from '@/domain/types';
import type { CommerceProvider, RevalidatedCart } from './CommerceProvider';

/**
 * Sample catalogue for the concept build. Shares data/sample-catalogue.json
 * with the offline HTML demo, so both show the same sample pieces.
 *
 * Every product is `sample: true`; names, codes, prices, sizes, stock and
 * lead times are invented and the UI labels them so. Material, care and
 * origin are deliberately left undefined — the brief forbids inferring them
 * from imagery — and the product page says they come from product data.
 */

type RawProduct = (typeof catalogue.products)[number];

function altFor(id: string): string {
  return assetRegistry[id as AssetId]?.alt ?? '';
}

function toProduct(raw: RawProduct, market: Market): Product {
  const prices = raw.price as Record<string, string>;
  return {
    id: raw.id,
    code: raw.code,
    name: raw.name,
    category: raw.category as CategoryId,
    colours: raw.colours,
    media: raw.media.map((assetId) => ({ assetId, alt: altFor(assetId) })),
    price: { amount: prices[market.id] ?? prices.ZA ?? '0.00', currencyCode: market.currencyCode },
    variants: raw.sizes.map((s) => ({
      id: `${raw.id}:${s.label}`,
      size: s.label,
      stock: s.stock as StockStatus,
    })),
    preorder:
      'preorderLeadTime' in raw && raw.preorderLeadTime
        ? { leadTime: raw.preorderLeadTime }
        : undefined,
    sizeGuideId: 'sizeGuide' in raw ? raw.sizeGuide : undefined,
    releasedAt: raw.released,
    pairsWith: raw.pairsWith,
    sample: true,
  };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class MockCommerceProvider implements CommerceProvider {
  readonly id = 'mock';
  readonly isMock = true;
  private sessions = new Map<string, CheckoutSession>();
  private orders: OrderSummary[];

  /**
   * Orders live in memory: a restart brings back just the sample order. That
   * is deliberate for a demo — nothing here should look like a record.
   */
  constructor(private readonly latencyMs = 0) {
    const sample = catalogue.sampleOrder;
    this.orders = [
      {
        id: sample.id,
        createdAt: new Date(Date.now() - 2.5 * 3600_000).toISOString(),
        marketId: 'ZA',
        lines: sample.lines.map((l) => ({
          productId: l.productId,
          variantId: `${l.productId}:${l.size}`,
          size: l.size,
          quantity: l.quantity,
        })),
        sample: true,
      },
    ];
  }

  private market(id: MarketId): Market {
    return catalogue.markets.find((m) => m.id === id) ?? catalogue.markets[0]!;
  }

  async listMarkets(): Promise<Market[]> {
    return catalogue.markets;
  }

  async listCategories(): Promise<Category[]> {
    return catalogue.categories.map((c) => ({
      id: c.id as CategoryId,
      label: c.label,
      assetId: c.asset,
    }));
  }

  async listProducts(market: MarketId): Promise<Product[]> {
    await wait(this.latencyMs);
    const m = this.market(market);
    return catalogue.products.map((p) => toProduct(p, m));
  }

  async getProduct(id: string, market: MarketId): Promise<Product | null> {
    await wait(this.latencyMs);
    const raw = catalogue.products.find((p) => p.id === id);
    return raw ? toProduct(raw, this.market(market)) : null;
  }

  async getSizeGuide(id: string): Promise<SizeGuide | null> {
    const guides = catalogue.sizeGuides as Record<
      string,
      Omit<SizeGuide, 'id' | 'unit'> & { unit: string }
    >;
    const g = guides[id];
    return g ? { id, title: g.title, unit: 'cm', columns: g.columns, rows: g.rows } : null;
  }

  async listStories(): Promise<Story[]> {
    // No `body`: story copy waits for brand approval, and the UI says so.
    return catalogue.stories.map((s) => ({
      id: s.id,
      kind: s.kind,
      title: s.title,
      heroAssetId: s.hero,
      mediaAssetIds: s.media,
      productIds: s.products,
    }));
  }

  async revalidateCart(lines: CartLine[], market: MarketId): Promise<RevalidatedCart> {
    await wait(this.latencyMs);
    const out: RevalidatedCart = { lines: [], problems: [] };
    for (const line of lines) {
      const product = await this.getProduct(line.productId, market);
      if (!product) {
        out.problems.push({ kind: 'removed', line });
        continue;
      }
      const variant = product.variants.find((v) => v.id === line.variantId);
      if (!variant || variant.stock === 'unavailable')
        out.problems.push({ kind: 'unavailable', line });
      out.lines.push({ line, product });
    }
    return out;
  }

  async startCheckout(
    lines: CartLine[],
    market: MarketId,
    idempotencyKey: string,
    simulate: CheckoutOutcome = 'confirmed',
  ): Promise<CheckoutSession> {
    await wait(this.latencyMs);
    const existing = this.sessions.get(idempotencyKey);
    // A retry with the same key never creates a second order. A pending
    // session may resolve to confirmed; a finished one is returned as-is.
    if (existing && existing.outcome !== 'pending') return existing;
    const outcome = existing?.outcome === 'pending' ? 'confirmed' : simulate;
    const session: CheckoutSession = { idempotencyKey, outcome };
    if (outcome === 'confirmed') {
      const order: OrderSummary = {
        id: `DEMO-ORDER-${String(this.orders.length + 1).padStart(4, '0')}`,
        createdAt: new Date().toISOString(),
        marketId: market,
        lines: lines.map((l) => ({ ...l })),
        sample: true,
      };
      this.orders.unshift(order);
      session.orderId = order.id;
    }
    this.sessions.set(idempotencyKey, session);
    return session;
  }

  async listOrders(): Promise<OrderSummary[]> {
    return [...this.orders];
  }

  async getOrder(id: string): Promise<OrderSummary | null> {
    return this.orders.find((o) => o.id === id) ?? null;
  }
}
