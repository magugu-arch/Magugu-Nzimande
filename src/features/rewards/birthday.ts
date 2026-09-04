/**
 * Whether today falls in the customer's birthday month.
 *
 * The Birthday Boneless Box costs nothing and states its own rule four times
 * over — on the reward, in its terms, and again on the reward screen: "Unlocks
 * automatically during your birthday month." Redeemability was computed as
 *
 *     !rewardExpired(reward) && reward.category !== 'birthday' && balance >= cost
 *
 * so the category was excluded outright and no date, month or balance could
 * make it true. The promise was made everywhere and kept nowhere.
 *
 * Read off the string rather than through `new Date(value).getMonth()`. An ISO
 * date parses as UTC midnight and `getMonth` reads local, so `1994-07-01` is
 * *June* on any device west of Greenwich — and the customer born on the first
 * of the month is precisely the one who would be told to come back later. The
 * same reasoning as the published trading hours: a wall-clock date compared
 * against a wall clock, with no timezone arithmetic invented in between.
 *
 * Nothing on file is not a birthday. The reward's own terms already say what
 * to do about that — "Add your date of birth to your profile to qualify" —
 * so the honest answer here is no, and the screen can explain it.
 */
export function inBirthdayMonth(dateOfBirth: string | undefined, now: Date = new Date()): boolean {
  const month = birthMonth(dateOfBirth);
  return month !== null && month === now.getMonth();
}

/** The zero-based month of an ISO `YYYY-MM-DD`, or null if it is not one. */
function birthMonth(dateOfBirth: string | undefined): number | null {
  if (typeof dateOfBirth !== 'string') return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateOfBirth.trim());
  if (!match) return null;

  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? month - 1 : null;
}

/**
 * The birthday month as a query-key component, or null when nothing is on file.
 *
 * Exported so the cache is keyed by the thing redeemability actually depends
 * on. Without it a list cached in June still says the birthday box is locked
 * on the first of July.
 */
export function birthdayMonthOf(dateOfBirth: string | undefined): number | null {
  return birthMonth(dateOfBirth);
}
