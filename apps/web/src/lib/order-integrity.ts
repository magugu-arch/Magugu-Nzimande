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
 * One line, as the catalogue has it today.
 *
 * The line comes back rebuilt — today's name, today's image, today's price —
 * and whether that price is the one the caller sent is deliberately not decided
 * here. Two callers need opposite things from a difference: the order route
 * must refuse, because a total is already on the customer's screen, and the
 * reorder endpoint must carry the line at the new price and say so, because
 * nothing has been shown yet and there is still time to tell them.
 *
 * Split out when the second caller arrived rather than copied, so there is one
 * answer to "what does this line cost" and the disagreement is only about what
 * to do with it.
 */
type PricedLine = { ok: true; line: OrderLine } | { ok: false; problem: string };

function priceLine(line: OrderLine): PricedLine {
  // `findProduct` reads the catalogue as the API serves it, so a hidden
  // product and a slug that was never on the menu both land here. The old
  // sold-out and hidden checks let a wholly invented slug through, because
  // an unknown slug is not on either list.
  const product = findProduct(line.slug);
  if (!product) return { ok: false, problem: 'That item is not on the menu' };
  if (product.soldOut) return { ok: false, problem: `${product.name} is sold out` };

  const deltas = optionDeltas(product.optionGroups, line.options);
  if ('problem' in deltas) return { ok: false, problem: deltas.problem };

  // Rebuilt rather than passed through, so the stored order carries the
  // server's numbers and the server's product name.
  return {
    ok: true,
    line: {
      ...line,
      name: product.name,
      imageKey: product.imageKey,
      unitCents: product.priceCents + deltas.deltaCents,
    },
  };
}

/**
 * Re-prices a whole basket, and reports every line that fails rather than the
 * first — a customer fixing a basket should see all of it at once.
 */
export function repriceLines(lines: readonly OrderLine[]): RepricedBasket {
  const problems: LineProblem[] = [];
  const priced: OrderLine[] = [];

  for (const line of lines) {
    const result = priceLine(line);
    if (!result.ok) {
      problems.push({ slug: line.slug, problem: result.problem });
      continue;
    }

    if (result.line.unitCents !== line.unitCents) {
      problems.push({
        slug: line.slug,
        problem: `${result.line.name} is priced at ${result.line.unitCents} cents, not ${line.unitCents}`,
      });
      continue;
    }

    priced.push(result.line);
  }

  return problems.length > 0 ? { ok: false, problems } : { ok: true, lines: priced };
}

export type RepricedLine = {
  slug: string;
  name: string;
  wasCents: number;
  nowCents: number;
};

/**
 * A line that cannot come back, and what the customer called it.
 *
 * `LineProblem` carries the slug, which is right for the order route: its
 * problems go to a basket screen that already has the line on it. Here there is
 * no line to point at — it is being left out — so the name comes along, taken
 * off the past order rather than the catalogue. The catalogue is frequently the
 * reason it is being dropped, and "that item is not on the menu" is a sentence
 * about nothing in particular.
 */
export type DroppedLine = { slug: string; name: string; problem: string };

/**
 * What a basket assembled from a past order is worth now.
 *
 * Per line rather than all or nothing, which is the whole difference from
 * `repriceLines`. That function answers a customer standing at the till with a
 * total in front of them, and the only honest answer there is to refuse the lot
 * and say why. This one answers the moment they press "order this again", when
 * nothing has been shown yet and every line can be dealt with on its own.
 *
 * So a line whose price has moved is kept, at today's price, and named. The
 * customer still wants the food; what they must not do is meet the new number
 * for the first time at the end of checkout. A line that has sold out or left
 * the menu is dropped and named, because there is nothing to keep.
 *
 * This is not a way around the order route's check. That route still prices
 * everything again and still refuses a basket whose numbers disagree; this is
 * how a customer finds out before they get there instead of after.
 */
export function repriceForReorder(lines: readonly OrderLine[]): {
  lines: OrderLine[];
  repriced: RepricedLine[];
  dropped: DroppedLine[];
} {
  const kept: OrderLine[] = [];
  const repriced: RepricedLine[] = [];
  const dropped: DroppedLine[] = [];

  for (const line of lines) {
    const result = priceLine(line);
    if (!result.ok) {
      dropped.push({ slug: line.slug, name: line.name, problem: result.problem });
      continue;
    }

    if (result.line.unitCents !== line.unitCents) {
      repriced.push({
        slug: line.slug,
        name: result.line.name,
        wasCents: line.unitCents,
        nowCents: result.line.unitCents,
      });
    }

    kept.push(result.line);
  }

  return { lines: kept, repriced, dropped };
}
