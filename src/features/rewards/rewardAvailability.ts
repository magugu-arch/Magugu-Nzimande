import type { Product, Reward } from '@/types';
import { isSoldOut, soldOutReason } from '@/features/menu/availability';

/**
 * Whether the dish a reward promises can actually be ordered today.
 *
 * A `food` reward is a claim about the menu, and until `Reward.productId`
 * existed it was a claim nothing could check. "Free Cheesling Fries" sat in the
 * catalogue at 650 points, drawn with a photograph of the dish and a sentence
 * about it, while Cheesling Fries had every option in its required Size group
 * sold out — so a member could spend the points and then find the menu would
 * not put the item in their basket.
 *
 * The Offers screen has answered exactly this question for promotions since
 * `promotedProductId` was written: a fortnight-long campaign outlives a day's
 * stock, and the screen that sends somebody to a dish has to know whether the
 * dish is there. A rewards catalogue is the same shape of promise with a
 * points price on it, and had none of the same protection.
 *
 * Returns null when there is nothing to say — which is most of the time, and
 * includes every reward that is not about a specific dish. A `delivery` or
 * `discount` reward is worth a fee or a rand amount and has no product to be
 * out of stock.
 */
export function rewardUnavailableReason(
  reward: Pick<Reward, 'productId'>,
  products: Product[] | undefined,
): string | null {
  if (!reward.productId || !products) return null;

  const product = products.find((candidate) => candidate.id === reward.productId);
  // A reward naming a product the menu has never heard of is a data problem
  // rather than a stock one, and saying "sold out" about it would be a guess.
  // `audit:launch` is where that belongs; this screen stays quiet.
  if (!product) return null;
  if (!isSoldOut(product)) return null;

  /*
    The menu's own words, so the reward screen and the product screen give the
    same explanation for the same fact. `soldOutReason` already distinguishes
    the two ways a dish can be unorderable — withdrawn, versus on the menu with
    nothing left to choose — and telling somebody "this is sold out" over a
    product page showing three greyed sizes is the confusion it exists to avoid.
  */
  return soldOutReason(product);
}

/** Whether the reward can be spent right now, ignoring points and dates. */
export function rewardIsOrderable(
  reward: Pick<Reward, 'productId'>,
  products: Product[] | undefined,
): boolean {
  return rewardUnavailableReason(reward, products) === null;
}
