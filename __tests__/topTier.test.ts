import { readFileSync } from 'node:fs';
import path from 'node:path';
import { standingFor, tiers } from '@/services/data/rewardsData';
import { rewardProgressLabel, tierProgressLabel } from '@/features/rewards/progressLabel';

/**
 * The top of the ladder, which nothing had ever reached.
 *
 * Black asks for 9 000 lifetime points and the seeded member has about 2 240,
 * so the top rung could only be reached by placing thirty-odd orders in one
 * session. Everything the app says to somebody who has arrived — "You're at
 * our top tier", and the notification reading "Black is the top of bb.q
 * Rewards. Everything is unlocked." — was written, styled, and rendered for
 * nobody.
 *
 * `EXPO_PUBLIC_SEED_PROFILE=top-tier` makes it reachable, the same mechanism
 * `new-customer` uses for the other end of the ladder. Both are mock-only, and
 * `audit:launch` fails a production build with the mock on at all.
 */
const TOP = Math.max(...tiers.map((tier) => tier.threshold));

describe('a member at the top of the ladder', () => {
  const standing = standingFor(TOP + 1_250);

  it('has no tier left to climb to', () => {
    expect(standing.tierName).toBe('Black');
    expect(standing.nextTier).toBeUndefined();
    expect(standing.pointsToNextTier).toBe(0);
    expect(standing.tierProgress).toBe(1);
  });

  /**
   * The defect, found in Chromium with the profile switched on. Both loyalty
   * progress bars announced `${percent} percent to next tier`, so at the top
   * a screen reader was told **"100 percent to next tier"** — directly under
   * text reading "You're at our top tier". All the way to a tier that does not
   * exist.
   */
  it('is not told it is on its way to a tier that does not exist', () => {
    const label = tierProgressLabel(standing);

    expect(label).not.toMatch(/next tier/i);
    expect(label).not.toMatch(/percent/i);
    expect(label).toBe('Black, the top of bb.q Rewards');
  });

  it('names the tier being climbed to, below the top', () => {
    // Halfway from Silver's 1 500 to Gold's 4 000.
    expect(tierProgressLabel(standingFor(2_750))).toBe('50 percent of the way to Gold');
  });

  it('names it at the bottom of the ladder too', () => {
    expect(tierProgressLabel(standingFor(0))).toBe('0 percent of the way to Silver');
  });

  /**
   * Written from the ladder, so a threshold that moves takes the fixture with
   * it. A hard-coded 10 250 would quietly stop being the top the day somebody
   * set Black to 12 000.
   */
  it('derives the fixture from the ladder rather than a typed number', () => {
    const seed = readFileSync(
      path.join(__dirname, '..', 'src/services/data/rewardsData.ts'),
      'utf8',
    );
    const block = seed.slice(
      seed.indexOf('const TOP_TIER_LIFETIME'),
      seed.indexOf('export const loyaltyAccount'),
    );

    expect(block).toMatch(/Math\.max\(\.\.\.tiers\.map/);
  });
});

/**
 * And the same shape one screen over.
 *
 * A reward's points bar is `pointsCost > 0 ? balance / pointsCost : 1`, so a
 * reward costing nothing filled the bar and announced "100 percent of the
 * points needed" — about the Birthday Boneless Box, priced at zero. The bar is
 * right to be full; the sentence is about points nobody asked for.
 */
describe('a reward that costs nothing', () => {
  it('says so rather than quoting a percentage of nought', () => {
    expect(rewardProgressLabel(0, 1)).toBe('No points needed');
  });

  it('still quotes the percentage for a reward that has a price', () => {
    expect(rewardProgressLabel(400, 0.5)).toBe('50 percent of the points needed');
    expect(rewardProgressLabel(400, 1)).toBe('100 percent of the points needed');
  });
});

/** Nobody writes one of these out by hand again. */
describe('every loyalty progress bar asks the helper', () => {
  const code = (file: string) =>
    readFileSync(path.join(__dirname, '..', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it.each(['src/app/(tabs)/rewards.tsx', 'src/app/(tabs)/home.tsx'])(
    '%s labels its tier bar through tierProgressLabel',
    (file) => {
      expect(code(file)).toMatch(/accessibilityLabel=\{tierProgressLabel\(/);
    },
  );

  it('the reward screen labels its points bar through rewardProgressLabel', () => {
    expect(code('src/app/rewards/[id].tsx')).toMatch(/accessibilityLabel=\{rewardProgressLabel\(/);
  });

  it('no screen still says "percent to next tier"', () => {
    for (const file of [
      'src/app/(tabs)/rewards.tsx',
      'src/app/(tabs)/home.tsx',
      'src/app/rewards/[id].tsx',
    ]) {
      expect(code(file)).not.toMatch(/percent to next tier/);
    }
  });
});
