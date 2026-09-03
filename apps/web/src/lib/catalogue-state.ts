import { PRODUCTS, STORES, optionGroupsFor } from '@bbq/seed';
import type { Product, ProductWithOptions, ServiceMode, Store } from '@bbq/types';
import { mutateState, readState, pushAudit, type AuditEntry } from './demo-state';

/**
 * Availability and per-store service rules, as the operations console writes
 * them. State lives in the shared demo store so that every worker process
 * agrees; the read and write shapes here are what the Prisma implementation
 * has to satisfy.
 */

export type { AuditEntry };

export function recordAudit(who: string, what: string): void {
  mutateState((state) => pushAudit(state, who, what));
}

export function readAudit(): AuditEntry[] {
  return readState().audit;
}

/** Catalogue as the API serves it: hidden products removed, sold-out flagged. */
export function visibleProducts(): Product[] {
  const { soldOut, hidden } = readState();
  return PRODUCTS.filter((product) => !hidden.includes(product.slug)).map((product) => ({
    ...product,
    soldOut: soldOut.includes(product.slug),
  }));
}

export function findProduct(slug: string): ProductWithOptions | null {
  const product = visibleProducts().find((candidate) => candidate.slug === slug);
  if (!product) return null;
  return { ...product, optionGroups: optionGroupsFor(product) };
}

export function isSoldOut(slug: string): boolean {
  return readState().soldOut.includes(slug);
}

export function isHidden(slug: string): boolean {
  return readState().hidden.includes(slug);
}

export function hiddenSlugs(): string[] {
  return readState().hidden;
}

export function setSoldOut(slug: string, soldOut: boolean): void {
  mutateState((state) => {
    const without = state.soldOut.filter((candidate) => candidate !== slug);
    state.soldOut = soldOut ? [...without, slug] : without;
  });
}

/**
 * Replaces the whole sold-out list with what the till says.
 *
 * A replacement rather than a merge, because the till is the source of truth
 * for what has run out: merging would leave an item sold out on the website
 * after the kitchen restocked it, and nobody would know which system to blame.
 *
 * Only reached through `syncSoldOut`, which refuses to call it when the till
 * could not be read — "nothing is sold out" and "I could not ask" must not
 * become the same instruction.
 */
export function replaceSoldOut(slugs: readonly string[]): void {
  mutateState((state) => {
    state.soldOut = [...new Set(slugs)];
  });
}

export function setHidden(slug: string, hidden: boolean): void {
  mutateState((state) => {
    const without = state.hidden.filter((candidate) => candidate !== slug);
    state.hidden = hidden ? [...without, slug] : without;
  });
}

/** Stores with any console overrides applied over the seeded service rules. */
export function currentStores(): Store[] {
  const { services } = readState();
  return STORES.map((store) => ({
    ...store,
    services: { ...store.services, ...services[store.id] },
  }));
}

export function findStore(storeId: string): Store | null {
  return currentStores().find((store) => store.id === storeId) ?? null;
}

export function setService(storeId: string, mode: ServiceMode, enabled: boolean): void {
  mutateState((state) => {
    state.services[storeId] = { ...state.services[storeId], [mode]: enabled };
  });
}

/**
 * Whether a store will accept an order in this mode right now. The interface
 * asks this too, but the API is the one that has to be right — a dine-in order
 * for a store with dine-in switched off is rejected server side.
 */
export function servesMode(store: Store, mode: ServiceMode): boolean {
  return store.services[mode] === true;
}

/**
 * Whether this store delivers to this suburb.
 *
 * `POST /api/delivery/quote` has always refused a suburb outside every zone,
 * but the quote is advisory: nothing made the order route ask. A delivery
 * order naming a suburb this store does not cover — or covered by the *other*
 * store — was accepted and reached the kitchen queue as work nobody could do.
 *
 * Matched the same way the quote matches, so the two cannot disagree about
 * what "Sandton" means.
 */
export function deliversTo(store: Store, suburb: string): boolean {
  const wanted = suburb.trim().toLowerCase();
  return store.zones.some((zone) => zone.toLowerCase() === wanted);
}
