/** The brief's §10 ANALYTICS event list. Nothing else is tracked. */
export const ANALYTICS_EVENTS = [
  'book_start',
  'book_date_selected',
  'book_request_submitted',
  'quote_viewed',
  'quote_accepted',
  'contract_signed',
  'deposit_paid',
  'booking_confirmed',
  'music_played',
  'video_played',
  'epk_downloaded',
  'community_signup',
  'collaboration_submitted',
] as const;

export type AnalyticsEvent = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsProps = Record<string, string | number | boolean>;
