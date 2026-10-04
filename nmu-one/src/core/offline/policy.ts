/**
 * What may be kept for offline use — brief §25.
 *
 * Cache: today's timetable, recently viewed notifications, selected campus
 * information, saved events and tickets, and the safety contacts (which must
 * work with no signal at all — brief §13 "fallback behaviour when network
 * access fails").
 *
 * Never cache: money, funding, results, guardian views, wellbeing. A stale
 * balance shown as if current is worse than no balance (brief §25 "do not
 * silently show stale financial data"), and sensitive records should not
 * sit on a device longer than the screen that shows them.
 *
 * Keyed by the first element of a query key. Anything unlisted is 'never'.
 */
export type OfflinePolicy = 'cache' | 'never';

export const OFFLINE_POLICY: Record<string, OfflinePolicy> = {
  timetable: 'cache',
  teaching: 'cache',
  notifications: 'cache',
  'campus-map': 'cache',
  'safety-contacts': 'cache',
  'support-routes': 'cache',
  events: 'cache',
  tickets: 'cache',
  'shuttle-routes': 'cache',
  modules: 'cache',
  calendar: 'cache',

  account: 'never',
  transactions: 'never',
  funding: 'never',
  results: 'never',
  'guardian-fees': 'never',
  wellbeing: 'never',
};

export const offlinePolicyFor = (key: readonly unknown[]): OfflinePolicy =>
  OFFLINE_POLICY[String(key[0])] ?? 'never';
