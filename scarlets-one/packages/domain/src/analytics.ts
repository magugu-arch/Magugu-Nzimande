/** Versioned event names. Renaming one is a breaking change for reporting. */
export const ANALYTICS_VERSION = 1;

export const analyticsEvents = [
  'app_open',
  'onboarding_complete',
  'language_change',
  'fixture_view',
  'ticket_cta_tap',
  'match_centre_open',
  'matchday_guide_open',
  'venue_map_open',
  'membership_cta_tap',
  'passport_open',
  'offer_view',
  'offer_redeem_start',
  'offer_redeem_success',
  'fanzone_vote_submit',
  'fanzone_prediction_submit',
  'fanzone_quiz_complete',
  'fanzone_fancam_submit',
  'content_open',
  'video_start',
  'push_open',
  'support_request_submit',
] as const;
export type AnalyticsEvent = (typeof analyticsEvents)[number];

export type AnalyticsValue = string | number | boolean;

/**
 * Property names that must never reach general analytics: identity, contact
 * details, location, ticket data, raw provider payloads and anything about a
 * child. Matching is on whole words inside the key, so `fixture_id` passes
 * and `email`, `user_email` and `emailAddress` do not.
 */
const FORBIDDEN = [
  'name',
  'email',
  'phone',
  'address',
  'postcode',
  'location',
  'lat',
  'latitude',
  'lng',
  'lon',
  'longitude',
  'barcode',
  'ticket',
  'seat',
  'dob',
  'birthday',
  'age',
  'child',
  'payload',
  'token',
  'password',
  'member',
];

function words(key: string): string[] {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isForbiddenProperty(key: string): boolean {
  return words(key).some((word) => FORBIDDEN.includes(word));
}

export interface AnalyticsRecord {
  v: number;
  event: AnalyticsEvent;
  props: Record<string, AnalyticsValue>;
}

/**
 * Build an event that is safe to send. Forbidden keys and non-primitive
 * values are dropped, and the names of what was dropped are returned so a
 * test (or a development warning) can catch the mistake at its source.
 */
export function buildEvent(
  event: AnalyticsEvent,
  props: Record<string, unknown> = {},
): { record: AnalyticsRecord; dropped: string[] } {
  const safe: Record<string, AnalyticsValue> = {};
  const dropped: string[] = [];
  for (const [key, value] of Object.entries(props)) {
    const primitive =
      typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
    if (!primitive || isForbiddenProperty(key)) {
      dropped.push(key);
      continue;
    }
    safe[key] = value;
  }
  return { record: { v: ANALYTICS_VERSION, event, props: safe }, dropped };
}
