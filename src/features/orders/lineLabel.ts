import type { CartLine } from '@/types';
import { formatPrice } from '@/utils/money';

/**
 * What a screen reader is told about one line of an order.
 *
 * The receipt and the checkout review draw the same line the same way: a
 * thumbnail, then `1 × Honey Garlic Chicken`, the chosen options, and a price,
 * as three loose `Text`s inside an unlabelled `View`. Three fragments read out
 * with nothing joining them — "one times Honey Garlic Chicken", then "Medium
 * dot nine pieces", then "R 225.00" — arrive as three unrelated
 * announcements, and on a receipt with four items there is nothing to say
 * which price belonged to which item.
 *
 * The same rule as `features/menu/optionLabel` and `features/rewards/
 * progressLabel`: a screen reader is told what the screen says. Here that
 * means one sentence per line, in the order the eye reads it.
 *
 * The `×` is dropped rather than spelled. Voices disagree about it — some say
 * "times", some say nothing at all, which turns `1 × Honey Garlic Chicken`
 * into "one Honey Garlic Chicken" on one phone and "one times Honey Garlic
 * Chicken" on the next. `2 French Fries` is what the screen says, read aloud,
 * on both. Options are re-joined with commas for the same reason: the screen's
 * middot is a separator the eye understands and a voice does not.
 *
 * The price stays `formatPrice`, which is how every other price in the app is
 * already announced — `ProductCard`, `ProductRow` and `StickyCartBar` all pass
 * it straight into a label. A different reading of money here would be the
 * only one in the app.
 */
export function orderLineLabel(line: CartLine): string {
  const parts = [`${line.quantity} ${line.name}`];

  if (line.selectedOptions.length > 0) {
    parts.push(line.selectedOptions.map((option) => option.optionName).join(', '));
  }

  /*
    And the note, which is the reason this exists.

    `specialInstructions` is offered on every product screen, drawn on the cart
    row and drawn again in the checkout review — and then dropped by the
    receipt, which rendered quantity, name, options and price and nothing else.
    No seeded order carried one, so nothing downstream of payment had ever been
    asked to render it: the app showed a customer their note at every step up
    to the moment they paid, and then it was gone from the only record they
    keep. Said aloud as "note", because a bare clause read after the options
    sounds like another option.
  */
  if (line.specialInstructions) parts.push(`note: ${line.specialInstructions}`);

  parts.push(formatPrice(line.lineTotal));

  return parts.join(', ');
}
