import type { ProductOption } from '@/types';
import { formatPriceDelta } from '@/utils/money';

/**
 * What a screen reader is told about one option, built from what the screen
 * shows rather than from two of its fields.
 *
 * The label was `${option.name}, ${formatPriceDelta(option.priceDelta)}` — a
 * concatenation of two facts that drops three others and gets the first one
 * wrong. Three things were wrong with it, and all three are on the screen
 * where every order in this app is configured:
 *
 * **It announced a price nobody is charged.** `formatPriceDelta(0)` is the
 * string `'Free'`, and the visible row withholds the delta entirely when it is
 * zero. So a sighted customer sees "Small · 6 pieces" and a screen-reader user
 * hears "Small · 6 pieces, Free" — about a size of a R149 box. Twenty-four
 * options in the catalogue carry a zero delta, across sizes, drinks, add-ons
 * and flavours; every one of them said it.
 *
 * **It dropped the description.** "Serves 1 – 2" is drawn under the name and
 * was in no label anywhere.
 *
 * **It never said "Sold out".** The withdrawn option is greyed with a caption
 * saying so, and `a11yState` marks it disabled — which a screen reader renders
 * as "dimmed", not as a reason. Worse, the label went on quoting its price, so
 * the one option a customer cannot have was announced exactly like an offer.
 *
 * The rule this follows: **a screen reader is told what the screen says.** The
 * visible row shows the delta only when there is one, so this does too. That
 * avoids a per-kind judgement about when "Free" is informative — it is a
 * reasonable word for an add-on and nonsense for a flavour — by not making the
 * claim at all where the interface does not.
 */
export function optionLabel(
  option: Pick<ProductOption, 'name' | 'description' | 'priceDelta' | 'available'>,
): string {
  const parts = [option.name];

  if (option.description) parts.push(option.description);
  // Only when there is one, exactly as the row draws it.
  if (option.priceDelta !== 0) parts.push(formatPriceDelta(option.priceDelta));
  if (!option.available) parts.push('Sold out');

  return parts.join(', ');
}
