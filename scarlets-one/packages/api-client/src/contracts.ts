import { z } from 'zod';
import {
  HOME_MODULES,
  campaign,
  clubSection,
  contentItem,
  fanActivity,
  faq,
  fixture,
  hospitalityPackage,
  lineup,
  localizedText,
  matchEvent,
  matchStat,
  matchdayGuide,
  matchdayStage,
  mediaAsset,
  partner,
  passport,
  receipt,
  score,
  sourceMeta,
  sourced,
  supporterStory,
} from '@scarlets/domain';

/**
 * The API contract: one schema per payload, and the TypeScript types are
 * inferred from them. The server composes these shapes; the HTTP client
 * parses every response against them, so a provider change that breaks the
 * contract fails loudly at the boundary instead of quietly on a screen.
 */

export const ticketLink = z.object({
  url: z.string(),
  label: localizedText,
  kind: z.enum(['purchase', 'account', 'information']),
});

export const officialLink = z.object({
  url: z.string(),
  label: localizedText,
  confirmed: z.boolean(),
});

export const matchClock = z.object({
  period: z.enum(['pre', 'first_half', 'half_time', 'second_half', 'full_time']),
  /** Match minute, or null before kick-off. */
  minute: z.number().int().nullable(),
});
export type MatchClock = z.infer<typeof matchClock>;

export const matchPulse = z.object({
  fixture,
  score: score.nullable(),
  clock: matchClock,
  lastEvent: matchEvent.nullable(),
  meta: sourceMeta,
});
export type MatchPulse = z.infer<typeof matchPulse>;

const matchPhase = z.enum([
  'no_fixture',
  'pre_match',
  'matchday',
  'live',
  'half_time',
  'full_time',
]);

export const homePayload = z.object({
  /** Server clock, ISO UTC. Countdowns run from this, not the device clock. */
  now: z.string(),
  phase: matchPhase,
  modules: z.array(z.enum(HOME_MODULES)),
  fixture: sourced(fixture),
  pulse: matchPulse.nullable(),
  ticket: sourced(ticketLink).nullable(),
  stories: sourced(z.array(contentItem)),
  partner: campaign.nullable(),
  fanPrompt: fanActivity.nullable(),
  /** The next home fixture, for "plan your next visit" after a match. */
  nextHome: fixture.nullable(),
});
export type HomePayload = z.infer<typeof homePayload>;

export const tableRow = z.object({
  position: z.number().int(),
  team: z.string(),
  played: z.number().int(),
  points: z.number().int(),
});

export const fixturesPayload = z.object({
  now: z.string(),
  fixtures: sourced(z.array(fixture)),
  table: sourced(z.array(tableRow)),
});
export type FixturesPayload = z.infer<typeof fixturesPayload>;

export const matchCentrePayload = z.object({
  now: z.string(),
  fixture: sourced(fixture),
  score: score.nullable(),
  clock: matchClock,
  timeline: sourced(z.array(matchEvent)),
  lineups: sourced(z.array(lineup)),
  stats: sourced(z.array(matchStat)),
  report: contentItem.nullable(),
  poll: fanActivity.nullable(),
  ticket: sourced(ticketLink),
});
export type MatchCentrePayload = z.infer<typeof matchCentrePayload>;

export const matchdayPayload = z.object({
  now: z.string(),
  fixture: sourced(fixture),
  stage: matchdayStage,
  guide: sourced(matchdayGuide),
  ticket: sourced(ticketLink).nullable(),
  ticketAccount: sourced(ticketLink),
  hospitality: sourced(z.array(hospitalityPackage)),
  partner: campaign.nullable(),
});
export type MatchdayPayload = z.infer<typeof matchdayPayload>;

export const passportPayload = z.object({
  account: z.enum(['guest', 'signed_in']),
  passport: sourced(passport),
  offer: campaign.nullable(),
});
export type PassportPayload = z.infer<typeof passportPayload>;

export const tallyRow = z.object({
  optionId: z.string(),
  votes: z.number().int(),
  percent: z.number().int(),
});

export const fanZonePayload = z.object({
  now: z.string(),
  activities: sourced(z.array(fanActivity)),
  receipts: z.array(receipt),
  results: z.record(z.string(), z.array(tallyRow)),
  stories: sourced(z.array(supporterStory)),
  sponsor: campaign.nullable(),
});
export type FanZonePayload = z.infer<typeof fanZonePayload>;

export const submitResult = z.union([
  z.object({ ok: z.literal(true), receipt }),
  z.object({
    ok: z.literal(false),
    error: z.enum([
      'not_open',
      'closed',
      'duplicate',
      'rate_limited',
      'sign_in_required',
      'consent_required',
      'offline',
      'invalid',
    ]),
  }),
]);

export const clubSectionPayload = z.object({
  section: sourced(clubSection),
  stories: sourced(z.array(contentItem)),
});
export type ClubSectionPayload = z.infer<typeof clubSectionPayload>;

export const partnerWorldPayload = z.object({
  partners: sourced(z.array(partner)),
  campaigns: z.array(campaign),
  hospitality: sourced(z.array(hospitalityPackage)),
  shop: sourced(officialLink),
});
export type PartnerWorldPayload = z.infer<typeof partnerWorldPayload>;

export const notificationPreferences = z.object({
  matchAlerts: z.boolean(),
  ticketReminders: z.boolean(),
  clubNews: z.boolean(),
  partnerOffers: z.boolean(),
});

export const contentListPayload = sourced(z.array(contentItem));
export const contentPayload = sourced(contentItem);
export const clubPayload = sourced(z.array(clubSection));
export const helpPayload = sourced(z.array(faq));
export const mediaPayload = sourced(z.array(mediaAsset));
export const notificationPayload = sourced(notificationPreferences);

/** The illustrative /v1 surface from the brief, as one typed table. */
export const routes = {
  home: { method: 'GET', path: '/v1/home' },
  fixtures: { method: 'GET', path: '/v1/fixtures' },
  matchCentre: { method: 'GET', path: '/v1/fixtures/:id/centre' },
  matchday: { method: 'GET', path: '/v1/matchday/:fixtureId' },
  passport: { method: 'GET', path: '/v1/me/passport' },
  fanZone: { method: 'GET', path: '/v1/fanzone' },
  fanZoneSubmit: { method: 'POST', path: '/v1/fanzone/:activityId/submit' },
  fanZoneWithdraw: { method: 'POST', path: '/v1/fanzone/submissions/:receiptId/withdraw' },
  storyReport: { method: 'POST', path: '/v1/fanzone/stories/:storyId/report' },
  content: { method: 'GET', path: '/v1/content' },
  contentItem: { method: 'GET', path: '/v1/content/:id' },
  club: { method: 'GET', path: '/v1/club' },
  clubSection: { method: 'GET', path: '/v1/club/:id' },
  partnerWorld: { method: 'GET', path: '/v1/partners' },
  help: { method: 'GET', path: '/v1/help' },
  media: { method: 'GET', path: '/v1/media' },
  notificationPreferences: { method: 'GET', path: '/v1/notifications/preferences' },
  updateNotificationPreferences: { method: 'POST', path: '/v1/notifications/preferences' },
} as const;
