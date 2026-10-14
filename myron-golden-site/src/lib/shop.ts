import type { Book } from '@/content/types';
import type { SiteMode } from './env';

/**
 * The book shop's rules, shared by the pages, the cart (in the browser) and
 * the checkout action (on the server). Pure: the mode is passed in, nothing
 * reads the environment, and every price comes from the book record — the
 * cart only ever holds slugs and quantities.
 */

/** A book that can go in the cart, with everything the cart needs to show it. */
export interface ShopItem {
  slug: string;
  title: string;
  priceCents: number;
  /** The price is a preview stand-in, labelled wherever it shows. */
  isDemoPrice: boolean;
  maxPerOrder: number;
  /**
   * Cover image path, or null for a typeset cover. `placeholder` marks a
   * mock-up, which must be labelled wherever it appears.
   */
  cover: { src: string; alt: string; placeholder: boolean } | null;
}

export interface CartLine {
  slug: string;
  qty: number;
}

/** Different books in one order; Stripe allows far more, people need far fewer. */
export const MAX_CART_LINES = 10;

/**
 * The price this site may charge for a book. Production uses the confirmed
 * price only; preview falls back to the labelled demo price.
 */
export function shopPrice(
  book: Pick<Book, 'shop' | 'status'>,
  mode: SiteMode,
): { cents: number; demo: boolean } | null {
  if (!book.shop || book.status === 'draft' || book.status === 'archived') return null;
  if (book.shop.priceCents !== null) return { cents: book.shop.priceCents, demo: false };
  if (mode === 'preview' && book.shop.demoPriceCents) {
    return { cents: book.shop.demoPriceCents, demo: true };
  }
  return null;
}

export function shopCatalog(
  books: readonly Book[],
  mode: SiteMode,
  coverOf: (book: Book) => ShopItem['cover'] = () => null,
): ShopItem[] {
  const items: ShopItem[] = [];
  for (const book of books) {
    const price = shopPrice(book, mode);
    if (!price || !book.shop) continue;
    items.push({
      slug: book.slug,
      title: book.title,
      priceCents: price.cents,
      isDemoPrice: price.demo,
      maxPerOrder: book.shop.maxPerOrder,
      cover: coverOf(book),
    });
  }
  return items;
}

/**
 * Whatever came out of storage or a form, made safe: known books only,
 * whole quantities clamped to each book's limit, duplicates merged, order
 * kept, and no more than MAX_CART_LINES lines.
 */
export function normaliseCart(raw: unknown, catalog: readonly ShopItem[]): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));
  const out: CartLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const { slug, qty } = entry as { slug?: unknown; qty?: unknown };
    if (typeof slug !== 'string') continue;
    const item = bySlug.get(slug);
    const n = Math.floor(Number(qty));
    if (!item || !Number.isFinite(n) || n < 1) continue;
    const existing = out.find((line) => line.slug === slug);
    if (existing) existing.qty = Math.min(existing.qty + n, item.maxPerOrder);
    else if (out.length < MAX_CART_LINES) out.push({ slug, qty: Math.min(n, item.maxPerOrder) });
  }
  return out;
}

export interface CartSummary {
  lines: (CartLine & { item: ShopItem; lineCents: number })[];
  /** Copies in the cart, across all lines. */
  count: number;
  subtotalCents: number;
  hasDemoPrices: boolean;
}

export function summariseCart(
  lines: readonly CartLine[],
  catalog: readonly ShopItem[],
): CartSummary {
  const bySlug = new Map(catalog.map((item) => [item.slug, item]));
  const out: CartSummary = { lines: [], count: 0, subtotalCents: 0, hasDemoPrices: false };
  for (const line of lines) {
    const item = bySlug.get(line.slug);
    if (!item) continue;
    const lineCents = item.priceCents * line.qty;
    out.lines.push({ ...line, item, lineCents });
    out.count += line.qty;
    out.subtotalCents += lineCents;
    out.hasDemoPrices ||= item.isDemoPrice;
  }
  return out;
}

/** "boss-moves:2,from-the-trash-man-to-the-cash-man:1" — how the cart travels in a form. */
export function serialiseCart(lines: readonly CartLine[]): string {
  return lines.map((line) => `${line.slug}:${line.qty}`).join(',');
}

/** The inverse, strict: anything malformed returns null rather than a guess. */
export function parseCartField(value: string): CartLine[] | null {
  if (!value || value.length > 1000) return null;
  const lines: CartLine[] = [];
  for (const part of value.split(',')) {
    const match = /^([a-z0-9-]{1,120}):(\d{1,3})$/.exec(part.trim());
    if (!match) return null;
    lines.push({ slug: match[1]!, qty: Number(match[2]) });
  }
  return lines;
}

export function copiesLabel(count: number): string {
  return `${count} ${count === 1 ? 'book' : 'books'}`;
}
