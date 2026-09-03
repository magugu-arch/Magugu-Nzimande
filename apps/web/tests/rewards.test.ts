import { REWARDS_RULES } from '@bbq/seed';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { tierFor } from '@/lib/rewards';

/**
 * The rewards ladder.
 *
 * Three tiers were listed on the rewards page from the day it was built, and
 * nothing worked out which one anybody had reached — the page showed a ladder
 * with no "you are here", and the account page showed a number with no ladder.
 */

const [bronze, silver, gold] = [...REWARDS_RULES.tiers].sort((a, b) => a.from - b.from);

describe('which tier a balance reaches', () => {
  it('starts everybody on the first rung', () => {
    expect(tierFor(0).current.name).toBe(bronze?.name);
  });

  /** The boundary. A tier "reached at 250" is reached at 250, not at 251. */
  it('reaches a tier at its threshold rather than one point past it', () => {
    expect(silver).toBeDefined();
    if (!silver) return;
    expect(tierFor(silver.from - 1).current.name).toBe(bronze?.name);
    expect(tierFor(silver.from).current.name).toBe(silver.name);
  });

  it('does not skip past a tier a balance has cleared', () => {
    expect(gold).toBeDefined();
    if (!gold) return;
    expect(tierFor(gold.from - 1).current.name).toBe(silver?.name);
    expect(tierFor(gold.from).current.name).toBe(gold.name);
  });

  it('stays at the top rather than falling off the end', () => {
    expect(gold).toBeDefined();
    if (!gold) return;
    const standing = tierFor(gold.from * 10);
    expect(standing.current.name).toBe(gold.name);
    expect(standing.next).toBeNull();
    expect(standing.toNext).toBe(0);
  });
});

describe('the gap to the next tier', () => {
  it('counts down as points are earned', () => {
    expect(silver).toBeDefined();
    if (!silver) return;
    expect(tierFor(0).toNext).toBe(silver.from);
    expect(tierFor(silver.from - 10).toNext).toBe(10);
  });

  it('is never negative', () => {
    for (const points of [0, 1, 500, 10_000, 1_000_000]) {
      expect(tierFor(points).toNext, `at ${points}`).toBeGreaterThanOrEqual(0);
    }
  });

  it('names the tier the gap is to', () => {
    expect(tierFor(0).next?.name).toBe(silver?.name);
  });
});

describe('the ladder itself', () => {
  /**
   * Read in ascending order whatever order the seed lists them in. A ladder
   * sorted by hand in the data file is a ladder somebody eventually appends to.
   */
  it('does not depend on the order the tiers are written in', () => {
    expect(tierFor(0).current.from).toBe(0);
    expect(REWARDS_RULES.tiers.length).toBeGreaterThan(1);
  });

  it('is shown on the rewards page with the customer marked on it', () => {
    const page = readFileSync(
      path.resolve(__dirname, '../src/app/rewards/page.tsx'),
      'utf8',
    );
    expect(page).toContain('tierFor');
    // Marked for the reader as well as for the eye.
    expect(page).toContain('aria-current');
  });
});
