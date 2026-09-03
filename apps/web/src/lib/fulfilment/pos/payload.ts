import { optionGroupsFor } from '@bbq/seed';
import { PRODUCTS, modifierKey, type PosCatalogueMap } from '@bbq/seed';
import type { Order } from '@bbq/types';

/**
 * An order in the shape a till needs it, before any vendor's wire format.
 *
 * Written vendor-neutral on purpose. Every POS wants the same facts — which
 * branch, which items by their own codes, what the customer chose, what it
 * came to, who to shout for when it is ready — and differs only in how those
 * facts are spelled on the wire. Keeping the translation in one place means
 * GAAP's specification, when it arrives, is a serialiser over this rather than
 * a rewrite of the mapping.
 *
 * Money stays integer cents. A till that wants rands gets them from the
 * serialiser, not from a float living in here.
 */

export type PosLine = {
  itemCode: string;
  quantity: number;
  unitCents: number;
  /** Their modifier codes, in the order the customer chose them. */
  modifierCodes: string[];
  /** Our own names, for a kitchen docket a human reads. */
  description: string;
};

export type PosOrder = {
  /** Our order number, which is what a customer reads down a telephone. */
  reference: string;
  branchCode: string;
  orderTypeCode: string;
  placedAt: string;
  lines: PosLine[];
  subtotalCents: number;
  discountCents: number;
  deliveryCents: number;
  totalCents: number;
  customerName: string;
  customerPhone: string;
  note: string;
};

export type PosMappingFailure = { ok: false; missing: string[] };
export type PosMapped = { ok: true; order: PosOrder };

/**
 * Translates an order into codes, or says exactly what it could not translate.
 *
 * Fails as a whole rather than per line. A basket sent to the till with three
 * of its four items is an order the kitchen will make wrongly, and a customer
 * who paid for four — far worse than a rejected order somebody has to look at.
 */
export function toPosOrder(order: Order, map: PosCatalogueMap): PosMapped | PosMappingFailure {
  const missing: string[] = [];

  const branchCode = map.stores[order.storeId];
  if (!branchCode) missing.push(`store:${order.storeId}`);

  const orderTypeCode = map.orderTypes[order.mode];
  if (!orderTypeCode) missing.push(`orderType:${order.mode}`);

  const lines: PosLine[] = [];
  for (const line of order.lines) {
    const itemCode = map.products[line.slug];
    if (!itemCode) {
      missing.push(`product:${line.slug}`);
      continue;
    }

    /**
     * Modifier codes are looked up by group and choice together.
     *
     * The same "Large" is a different code on a side than on a drink, and a
     * lookup by label alone would find whichever the map happened to list
     * first — a wrong code the till accepts, which is the worst kind.
     */
    const modifierCodes: string[] = [];
    for (const option of line.options) {
      for (const choice of option.choices) {
        const key = modifierKey(option.groupKey, choice);
        const code = map.modifiers[key];
        if (!code) missing.push(`modifier:${key}`);
        else modifierCodes.push(code);
      }
    }

    lines.push({
      itemCode,
      quantity: line.quantity,
      unitCents: line.unitCents,
      modifierCodes,
      description: describeLine(line),
    });
  }

  if (missing.length > 0) return { ok: false, missing: [...new Set(missing)] };

  return {
    ok: true,
    order: {
      reference: order.orderNumber,
      branchCode: branchCode as string,
      orderTypeCode: orderTypeCode as string,
      placedAt: order.placedAt,
      lines,
      subtotalCents: order.totals.subtotalCents,
      discountCents: order.totals.discountCents,
      deliveryCents: order.totals.deliveryCents,
      totalCents: order.totals.totalCents,
      customerName: order.customer.name,
      customerPhone: order.customer.mobile,
      note: order.kitchenNote,
    },
  };
}

/** What a human reads on the docket, options included. */
function describeLine(line: Order['lines'][number]): string {
  const chosen = line.options
    .flatMap((option) => option.choices)
    .filter(Boolean)
    .join(', ');
  return chosen ? `${line.name} (${chosen})` : line.name;
}

/**
 * The codes a POS would have to be told about to accept anything we can sell.
 *
 * Generated from the catalogue rather than typed, so it is the list to hand a
 * vendor and it cannot go stale: adding a product changes what this returns.
 */
export function codesToRequest(): { products: string[]; modifiers: string[] } {
  const modifiers = new Set<string>();
  for (const product of PRODUCTS) {
    for (const group of optionGroupsFor(product)) {
      for (const choice of group.choices) modifiers.add(modifierKey(group.key, choice.label));
    }
  }
  return { products: PRODUCTS.map((product) => product.slug), modifiers: [...modifiers].sort() };
}
