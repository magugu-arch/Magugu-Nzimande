import { categories } from '@/services/data/menuData';
import type { Product } from '@/types';

/**
 * Finding a dish by typing part of its name.
 *
 * This was `haystack.includes(query)` over the name, both descriptions and the
 * tags joined into one string — so a query only matched if it appeared
 * contiguously, in order, punctuated exactly as the menu punctuates it. On a
 * sixteen-item menu, seven of ten plausible queries returned nothing:
 *
 *     "prawn and avocado" nothing   — the dish is Prawn & Avocado Salad
 *     "greek g t"         nothing   — the drink is Greek G&T
 *     "souvlaki pork"     nothing   — Pork Souvlaki, in the other order
 *     "mezedakia"         nothing   — a section, not a dish
 *
 * A customer who types the name of a dish and is told "We couldn't find
 * anything" concludes the restaurant does not sell it.
 *
 * So: fold the punctuation, split into words, and require every word somewhere
 * in the text rather than all of them together. Word order stops mattering, an
 * ampersand and the word "and" become the same thing, and a hyphen stops
 * hiding a dish from the only spelling most people will try.
 */

/**
 * Text reduced to what a customer is actually typing at.
 *
 * `&` becomes "and" before the rest of the punctuation goes, because dropping
 * it silently would turn "Half & Half" into "half half" and leave "half and
 * half" unmatchable — trading one missed spelling for another. Accents are
 * folded so "rosé" finds "Rose"; the menu has none today and the day it gains
 * one is not the day to discover this.
 */
export function normaliseForSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The name of the section a dish sits under.
 *
 * Included in what a dish matches against, because on this menu the section
 * name is very often what a customer types. "Mezedakia" is not the name of
 * any single dish — it is the name of eight of them together — and a customer
 * who types it and is told "We couldn't find anything" concludes a Greek
 * restaurant does not serve meze.
 *
 * The same holds for "souvlaki", "fish market" and "breakfast": each is a
 * category, each is the obvious thing to type, and only one of them happens
 * to also appear in a dish name.
 */
function categoryNameFor(product: Product): string {
  return categories.find((category) => category.id === product.categoryId)?.name ?? '';
}

/** Everything about a product worth matching against, normalised once. */
function haystackFor(product: Product): string {
  return normaliseForSearch(
    [
      product.name,
      product.shortDescription,
      product.description,
      categoryNameFor(product),
      ...product.tags,
    ].join(' '),
  );
}

function tokens(query: string): string[] {
  return normaliseForSearch(query).split(' ').filter(Boolean);
}

/**
 * The products a query is asking for, best first.
 *
 * Everything matching every word comes first, in menu order. Then — and only
 * when nothing matched every word — the near misses, most words matched first.
 *
 * The fallback is what turns "honey garlic wings" from a dead end into Honey
 * Garlic Chicken and Golden Original Wings. It costs nothing when the query is
 * good and is the difference between a menu and an apology when it is not; an
 * empty state on a sixteen-item menu is nearly always the search's fault
 * rather than the kitchen's.
 */
export function matchProducts(products: Product[], query: string): Product[] {
  const words = tokens(query);
  if (words.length === 0) return [];

  const scored = products.map((product) => {
    const haystack = haystackFor(product);
    return { product, hits: words.filter((word) => haystack.includes(word)).length };
  });

  const all = scored.filter((entry) => entry.hits === words.length);
  if (all.length > 0) return all.map((entry) => entry.product);

  return scored
    .filter((entry) => entry.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .map((entry) => entry.product);
}
