/**
 * Provider catalogue mapping — extension §8.
 *
 * The rule: "Support provider-specific menu, modifier, price and availability
 * mappings without duplicating the canonical PAPPAS catalogue" (§1), and
 * §11's acceptance criterion that this works "without duplicating the core
 * menu".
 *
 * So the canonical menu stays exactly where it is, in the app's own menu
 * data, and this file holds only the *differences*: this dish is called
 * something else on that channel, costs more there because the channel takes
 * a commission, or is not listed there at all.
 *
 * Why differences rather than a per-channel menu:
 *
 * A marketplace menu drifts. Left as three full catalogues, a new dish is
 * added to one and forgotten in the others, a price correction lands in two
 * of three, and the discrepancy is invisible until a customer is charged the
 * wrong amount. Holding only overrides means the default answer for every
 * dish on every channel is the canonical one, and an override is a small,
 * visible, auditable statement that someone made on purpose.
 *
 * Prices here are *channel* prices, in cents, and they are commercial
 * decisions — §8 forbids hard-coding commissions and settlement rules, so
 * this table is data the business fills in, not arithmetic the app performs.
 * There is deliberately no "add 30% for marketplace" function anywhere.
 */

import type { ProviderId } from './types';

/** What a channel does differently for one canonical dish. */
export interface ProviderCatalogueEntry {
  /** The canonical Pappas SKU. Always present — it is the join key. */
  pappasSku: string;
  /** The channel's own identifier, when it differs. */
  providerSku?: string;
  /** The channel's own display name, when it differs. */
  providerName?: string;
  /** Channel price in cents. Absent means the canonical price applies. */
  priceCents?: number;
  /**
   * Whether the dish is listed on this channel at all.
   *
   * Defaults to true. Set false for anything that cannot travel — a dish
   * served on a hot stone, a dessert that melts, anything plated to be eaten
   * where it is made. That is a kitchen judgement, recorded here so a
   * marketplace customer is never sold something that will arrive wrong.
   */
  providerAvailability?: boolean;
}

/** Overrides, keyed by provider then canonical SKU. */
export type CatalogueOverrides = Readonly<
  Partial<Record<ProviderId, Readonly<Record<string, ProviderCatalogueEntry>>>>
>;

/**
 * The live override table.
 *
 * Empty for the external channels, and correctly so: no marketplace listing
 * exists, so no dish has a marketplace name or price yet. Populating it with
 * invented prices would breach §15's "Do not invent menu prices" as squarely
 * as inventing a canonical one.
 *
 * `pappas-direct` has no overrides by definition — it *is* the canonical
 * catalogue, and an override there would mean the canonical menu disagreed
 * with itself.
 */
export const catalogueOverrides: CatalogueOverrides = {
  'pappas-direct': {},
  'uber-eats': {},
  'mr-d': {},
};

/** The canonical facts a mapping needs to fall back to. */
export interface CanonicalItem {
  sku: string;
  name: string;
  priceCents: number;
  available: boolean;
}

/** A dish as one channel sees it. */
export interface MappedItem {
  pappasSku: string;
  providerSku: string;
  name: string;
  priceCents: number;
  available: boolean;
  /** True when any field came from an override rather than the canonical row. */
  overridden: boolean;
}

/**
 * Resolve one dish for one channel.
 *
 * The canonical row is the answer unless an override says otherwise, field
 * by field. A channel with no entry for a SKU gets the canonical dish at the
 * canonical price under the canonical name — which is the behaviour that
 * makes adding a dish to the menu automatically correct everywhere.
 */
export function mapItemForProvider(
  item: CanonicalItem,
  provider: ProviderId,
  overrides: CatalogueOverrides = catalogueOverrides,
): MappedItem {
  const entry = overrides[provider]?.[item.sku];
  return {
    pappasSku: item.sku,
    providerSku: entry?.providerSku ?? item.sku,
    name: entry?.providerName ?? item.name,
    priceCents: entry?.priceCents ?? item.priceCents,
    // A dish unavailable canonically is unavailable everywhere: an override
    // may withdraw a dish from a channel but may not conjure one back that
    // the kitchen has taken off.
    available: item.available && (entry?.providerAvailability ?? true),
    overridden: entry !== undefined,
  };
}

/** Resolve a whole catalogue for a channel, dropping what it cannot sell. */
export function mapCatalogueForProvider(
  items: readonly CanonicalItem[],
  provider: ProviderId,
  overrides: CatalogueOverrides = catalogueOverrides,
): MappedItem[] {
  return items
    .map((item) => mapItemForProvider(item, provider, overrides))
    .filter((item) => item.available);
}

/**
 * Overrides that point at nothing.
 *
 * Extension §8 asks that catalogue synchronisation failures be logged in the
 * admin console. The commonest such failure is not a network error — it is an
 * override left behind after the dish it referred to was renamed or removed,
 * which then quietly stops applying. This finds them, so the admin console
 * has something true to report.
 */
export function orphanedOverrides(
  items: readonly CanonicalItem[],
  overrides: CatalogueOverrides = catalogueOverrides,
): { provider: ProviderId; pappasSku: string }[] {
  const known = new Set(items.map((item) => item.sku));
  const orphans: { provider: ProviderId; pappasSku: string }[] = [];
  for (const [provider, table] of Object.entries(overrides)) {
    for (const sku of Object.keys(table ?? {})) {
      if (!known.has(sku)) {
        orphans.push({ provider: provider as ProviderId, pappasSku: sku });
      }
    }
  }
  return orphans;
}
