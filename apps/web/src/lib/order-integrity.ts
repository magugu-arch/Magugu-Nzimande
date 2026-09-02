import type { OptionGroup, OrderLine, SelectedOption } from '@bbq/types';
import { findProduct } from './catalogue-state';

/**
 * What the server believes a basket costs.
 *
 * `POST /api/orders` used to recompute the *arithmetic* from the posted lines
 * but take each line's `unitCents` from the client, so a request could set its
 * own prices: one cent a bird, accepted and stored as a legitimate order with
 * loyalty points posted against it. The recomputation was real; the inputs
 * were not.
 *
 * Nothing a client sends about money is used here. Every line is priced again
 * from the catalogue — base price plus the deltas of the options it actually
 * carries — and a line whose claimed price disagrees is refused rather than
 * quietly corrected. A disagreement means either tampering or a basket built
 * before a price changed, and a customer in the second case is owed the news
 * rather than a different amount at the till.
 */

export type LineProblem = { slug: string; problem: string };

export type RepricedBasket =
  | { ok: true; lines: OrderLine[] }
  | { ok: false; problems: LineProblem[] };

/** The choices a group actually offers, by label. */
function choicesOf(group: OptionGroup): Map<string, number> {
  return new Map(group.choices.map((choice) => [choice.label, choice.deltaCents]));
}

/**
 * Prices one line's options against the product's real option groups.
 *
 * Returns the delta total, or a problem. An unknown group or an unknown label
 * is refused outright: several choices carry a *negative* delta (a half bird is
 * R70 off a whole one), so an unrecognised option is not something to skip past
 * — skipping it is how a discount gets applied twice.
 */
function optionDeltas(
  groups: readonly OptionGroup[],
  options: readonly SelectedOption[],
): { deltaCents: number } | { problem: string } {
  const byKey = new Map(groups.map((group) => [group.key, group]));
  let deltaCents = 0;

  for (const option of options) {
    const group = byKey.get(option.groupKey);
    if (!group) {
      return { problem: `${option.groupKey} is not an option group on this item` };
    }

    if (!group.multi && option.choices.length > 1) {
      return { problem: `${group.label} takes one choice, not ${option.choices.length}` };
    }

    const available = choicesOf(group);
    const seen = new Set<string>();

    for (const label of option.choices) {
      const delta = available.get(label);
      if (delta === undefined) {
        return { problem: `${label} is not a ${group.label} choice` };
      }
      // The same choice twice would count its delta twice.
      if (seen.has(label)) {
        return { problem: `${group.label} lists ${label} twice` };
      }
      seen.add(label);
      deltaCents += delta;
    }
  }

  return { deltaCents };
}

/**
 * Re-prices a whole basket, and reports every line that fails rather than the
 * first — a customer fixing a basket should see all of it at once.
 */
export function repriceLines(lines: readonly OrderLine[]): RepricedBasket {
  const problems: LineProblem[] = [];
  const priced: OrderLine[] = [];

  for (const line of lines) {
    // `findProduct` reads the catalogue as the API serves it, so a hidden
    // product and a slug that was never on the menu both land here. The old
    // sold-out and hidden checks let a wholly invented slug through, because
    // an unknown slug is not on either list.
    const product = findProduct(line.slug);
    if (!product) {
      problems.push({ slug: line.slug, problem: 'That item is not on the menu' });
      continue;
    }

    if (product.soldOut) {
      problems.push({ slug: line.slug, problem: `${product.name} is sold out` });
      continue;
    }

    const deltas = optionDeltas(product.optionGroups, line.options);
    if ('problem' in deltas) {
      problems.push({ slug: line.slug, problem: deltas.problem });
      continue;
    }

    const unitCents = product.priceCents + deltas.deltaCents;
    if (unitCents !== line.unitCents) {
      problems.push({
        slug: line.slug,
        problem: `${product.name} is priced at ${unitCents} cents, not ${line.unitCents}`,
      });
      continue;
    }

    // Rebuilt rather than passed through, so the stored order carries the
    // server's numbers and the server's product name.
    priced.push({
      ...line,
      name: product.name,
      imageKey: product.imageKey,
      unitCents,
    });
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, lines: priced };
}
