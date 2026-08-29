import { PRODUCTS, STORES, optionGroupsFor } from '@bbq/seed';
import type { Product, ProductWithOptions, ServiceMode, Store } from '@bbq/types';

/**
 * The operations console's writes live here until the Postgres layer lands.
 * A module-level store is process-local and resets on redeploy, which is fine
 * for a console driven by a single kitchen, and wrong for anything else — the
 * shape of the reads and writes is what the Prisma implementation has to match.
 */

type Availability = {
  /** Shown in the catalogue but blocked at add-to-basket. */
  soldOut: Set<string>;
  /** Absent from the catalogue response entirely. */
  hidden: Set<string>;
};

export type AuditEntry = {
  at: string;
  who: string;
  what: string;
};

const availability: Availability = { soldOut: new Set(), hidden: new Set() };

const serviceOverrides = new Map<string, Partial<Record<ServiceMode, boolean>>>();

const auditLog: AuditEntry[] = [
  { at: new Date().toISOString(), who: 'system', what: 'Demo catalogue loaded (16 products)' },
];

export function recordAudit(who: string, what: string): void {
  auditLog.unshift({ at: new Date().toISOString(), who, what });
  // The console reads the most recent entries only; an unbounded array in a
  // long-lived process is a leak, not a history.
  if (auditLog.length > 200) auditLog.length = 200;
}

export function readAudit(): readonly AuditEntry[] {
  return auditLog;
}

/** Catalogue as the API serves it: hidden products removed, sold-out flagged. */
export function visibleProducts(): Product[] {
  return PRODUCTS.filter((product) => !availability.hidden.has(product.slug)).map((product) => ({
    ...product,
    soldOut: availability.soldOut.has(product.slug),
  }));
}

export function findProduct(slug: string): ProductWithOptions | null {
  const product = visibleProducts().find((candidate) => candidate.slug === slug);
  if (!product) return null;
  return { ...product, optionGroups: optionGroupsFor(product) };
}

export function isSoldOut(slug: string): boolean {
  return availability.soldOut.has(slug);
}

export function setSoldOut(slug: string, soldOut: boolean): void {
  if (soldOut) availability.soldOut.add(slug);
  else availability.soldOut.delete(slug);
}

export function setHidden(slug: string, hidden: boolean): void {
  if (hidden) availability.hidden.add(slug);
  else availability.hidden.delete(slug);
}

export function isHidden(slug: string): boolean {
  return availability.hidden.has(slug);
}

/** Stores with any console overrides applied over the seeded service rules. */
export function currentStores(): Store[] {
  return STORES.map((store) => ({
    ...store,
    services: { ...store.services, ...serviceOverrides.get(store.id) },
  }));
}

export function findStore(storeId: string): Store | null {
  return currentStores().find((store) => store.id === storeId) ?? null;
}

export function setService(storeId: string, mode: ServiceMode, enabled: boolean): void {
  const existing = serviceOverrides.get(storeId) ?? {};
  serviceOverrides.set(storeId, { ...existing, [mode]: enabled });
}

/**
 * Whether a store will accept an order in this mode right now. The interface
 * asks this too, but the API is the one that has to be right — a dine-in order
 * for a store with dine-in off is rejected server side.
 */
export function servesMode(store: Store, mode: ServiceMode): boolean {
  return store.services[mode] === true;
}
