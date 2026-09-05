import type { LoyaltyAccount, TierDefinition } from '@/types';
import { tiers as defaultLadder } from '@/services/data/rewardsData';

/**
 * What a screen reader is told about a progress bar, on the two screens that
 * draw one for the loyalty ladder.
 *
 * Both said `${Math.round(tierProgress * 100)} percent to next tier`. At the
 * top of the ladder `standingFor` answers `tierProgress: 1` and no `nextTier`,
 * so the bar announced **"100 percent to next tier"** directly under text
 * reading "You're at our top tier" — a screen reader told somebody they were
 * all the way to a tier that does not exist.
 *
 * Nobody had seen it because Black asks for 9 000 lifetime points and the
 * seeded member has about 2 240, so the top rung could only be reached by
 * placing thirty-odd orders in one session. `EXPO_PUBLIC_SEED_PROFILE=top-tier`
 * is what makes it reachable, and the browser is where it was found.
 *
 * The same rule as `features/menu/optionLabel`: a screen reader is told what
 * the screen says. Below the top that means naming the tier being climbed to
 * rather than the words "next tier", which the bar cannot say and the sentence
 * beside it already does.
 */
export function tierProgressLabel(
  account: Pick<LoyaltyAccount, 'tierName' | 'nextTier' | 'tierProgress'>,
  ladder: TierDefinition[] = defaultLadder,
): string {
  const next = ladder.find((tier) => tier.tier === account.nextTier);

  if (!next) return `${account.tierName}, the top of bb.q Rewards`;
  return `${Math.round(account.tierProgress * 100)} percent of the way to ${next.name}`;
}

/**
 * And the same shape one screen over, on a reward's points bar.
 *
 * `progress` is `pointsCost > 0 ? balance / pointsCost : 1`, so a reward that
 * costs nothing filled the bar and announced "100 percent of the points
 * needed" — about a Birthday Boneless Box priced at zero. The bar is right to
 * be full; the sentence is about points that were never asked for.
 */
export function rewardProgressLabel(pointsCost: number, progress: number): string {
  if (pointsCost <= 0) return 'No points needed';
  return `${Math.round(progress * 100)} percent of the points needed`;
}
