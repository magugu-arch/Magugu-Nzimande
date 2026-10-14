import { describe, expect, it } from 'vitest';
import { books } from '@/content/books';
import type { Book } from '@/content/types';
import { getShopCatalog } from '@/lib/content';
import { bookOrderParams, encodeForm, shippingSetup } from '@/lib/payments';
import {
  MAX_CART_LINES,
  normaliseCart,
  parseCartField,
  serialiseCart,
  shopCatalog,
  shopPrice,
  summariseCart,
} from '@/lib/shop';

const book = (overrides: Partial<Book>): Book => ({ ...books[0]!, ...overrides });

describe('shop prices', () => {
  it('charges a confirmed price everywhere', () => {
    const b = book({ shop: { priceCents: 2495, maxPerOrder: 5 } });
    expect(shopPrice(b, 'production')).toEqual({ cents: 2495, demo: false });
    expect(shopPrice(b, 'preview')).toEqual({ cents: 2495, demo: false });
  });

  it('uses a demo price in preview only, and never in production', () => {
    const b = book({ shop: { priceCents: null, demoPriceCents: 2000, maxPerOrder: 5 } });
    expect(shopPrice(b, 'preview')).toEqual({ cents: 2000, demo: true });
    expect(shopPrice(b, 'production')).toBeNull();
  });

  it('never sells drafts or books without shop settings', () => {
    expect(shopPrice(book({ shop: null }), 'preview')).toBeNull();
    expect(
      shopPrice(book({ status: 'draft', shop: { priceCents: 1000, maxPerOrder: 1 } }), 'preview'),
    ).toBeNull();
  });

  it('has no real book on sale in production until a price is confirmed', () => {
    expect(getShopCatalog('production')).toEqual([]);
    const preview = getShopCatalog('preview');
    expect(preview.length).toBeGreaterThan(0);
    expect(preview.every((i) => i.isDemoPrice)).toBe(true);
    expect(preview.every((i) => i.cover === null || i.cover.placeholder)).toBe(true);
  });
});

describe('cart lines', () => {
  const catalog = shopCatalog(
    [
      book({ slug: 'a', shop: { priceCents: 1000, maxPerOrder: 3 } }),
      book({ slug: 'b', shop: { priceCents: 2500, maxPerOrder: 10 } }),
    ],
    'production',
  );

  it('drops unknown books and junk, merges duplicates, clamps to the limit', () => {
    const lines = normaliseCart(
      [
        { slug: 'a', qty: 2 },
        { slug: 'nope', qty: 1 },
        { slug: 'a', qty: 5 },
        { slug: 'b', qty: 0 },
        { slug: 'b', qty: 1.7 },
        'junk',
        null,
      ],
      catalog,
    );
    expect(lines).toEqual([
      { slug: 'a', qty: 3 },
      { slug: 'b', qty: 1 },
    ]);
    expect(normaliseCart('not an array', catalog)).toEqual([]);
  });

  it('caps the number of different books', () => {
    const many = Array.from({ length: MAX_CART_LINES + 5 }, (_, i) =>
      book({ slug: `book-${i}`, shop: { priceCents: 100, maxPerOrder: 1 } }),
    );
    const cat = shopCatalog(many, 'production');
    const lines = normaliseCart(
      cat.map((i) => ({ slug: i.slug, qty: 1 })),
      cat,
    );
    expect(lines).toHaveLength(MAX_CART_LINES);
  });

  it('totals from catalog prices only', () => {
    const summary = summariseCart(
      [
        { slug: 'a', qty: 2 },
        { slug: 'b', qty: 1 },
      ],
      catalog,
    );
    expect(summary.count).toBe(3);
    expect(summary.subtotalCents).toBe(4500);
    expect(summary.lines.map((l) => l.lineCents)).toEqual([2000, 2500]);
  });

  it('round-trips through the form field, and refuses anything malformed', () => {
    const lines = [
      { slug: 'boss-moves', qty: 2 },
      { slug: 'from-the-trash-man-to-the-cash-man', qty: 1 },
    ];
    expect(parseCartField(serialiseCart(lines))).toEqual(lines);
    expect(parseCartField('')).toBeNull();
    expect(parseCartField('boss-moves:2,<script>:1')).toBeNull();
    expect(parseCartField('boss-moves:2:9')).toBeNull();
    expect(parseCartField('boss-moves:-1')).toBeNull();
    expect(parseCartField('a:1,'.repeat(300))).toBeNull();
  });
});

describe('book checkout', () => {
  it('sends every line with server prices, collects an address and tags the order', () => {
    const form = encodeForm(
      bookOrderParams({
        reference: 'MG-ABCD-EFGH',
        lines: [
          { slug: 'boss-moves', title: 'B.O.S.S. Moves', unitAmountCents: 2000, quantity: 2 },
          { slug: 'trash', title: 'Trash Man', unitAmountCents: 1500, quantity: 1 },
        ],
        shipping: { rateId: 'shr_123', countries: ['US', 'CA'] },
        successUrl: 'https://site.example/orders/confirmed?session_id={CHECKOUT_SESSION_ID}',
        cancelUrl: 'https://site.example/cart?checkout=cancelled',
        now: 1_800_000_000,
      }),
    );
    expect(form.get('line_items[0][quantity]')).toBe('2');
    expect(form.get('line_items[1][price_data][unit_amount]')).toBe('1500');
    expect(form.get('shipping_address_collection[allowed_countries][1]')).toBe('CA');
    expect(form.get('shipping_options[0][shipping_rate]')).toBe('shr_123');
    expect(form.get('metadata[kind]')).toBe('books');
    expect(form.get('metadata[items]')).toBe('boss-moves:2,trash:1');
  });

  it('reads shipping settings strictly', () => {
    expect(shippingSetup({})).toEqual({ rateId: null, countries: ['US'] });
    expect(
      shippingSetup({ STRIPE_SHIPPING_RATE_ID: 'shr_abc', SHOP_SHIP_TO: 'us, gb, x' }),
    ).toEqual({ rateId: 'shr_abc', countries: ['US', 'GB'] });
    expect(shippingSetup({ STRIPE_SHIPPING_RATE_ID: 'price_123' }).rateId).toBeNull();
  });
});
