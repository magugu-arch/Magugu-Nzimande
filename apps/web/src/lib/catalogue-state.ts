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
