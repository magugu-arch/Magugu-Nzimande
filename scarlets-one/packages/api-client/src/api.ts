import type { Account, NotificationPreferences, SubmitResult } from '@scarlets/adapters';
import type {
  ClubSection,
  ContentCategory,
  ContentItem,
  ContentKind,
  Faq,
  Locale,
  MediaAsset,
  ReportReason,
  Sourced,
  Squad,
} from '@scarlets/domain';
import type {
  ClubSectionPayload,
  FanZonePayload,
  FixturesPayload,
  HomePayload,
  MatchCentrePayload,
  MatchdayPayload,
  PartnerWorldPayload,
  PassportPayload,
} from './contracts';

export interface RequestContext {
  locale: Locale;
  account: Account;
}

/**
 * Everything the app can ask for. Two implementations satisfy it:
 *
 *   createService()  composes the provider adapters directly. It is the body
 *                    of the server (an Edge Function) and, in demo mode, runs
 *                    in-process so the app works with no backend at all.
 *   createHttpApi()  calls that server over HTTPS and validates each reply.
 *
 * Screens depend on this interface only, so switching from demo to a real
 * backend is a one-line change in the app's provider.
 */
export interface ScarletsApi {
  getHome(ctx: RequestContext): Promise<HomePayload>;
  getFixtures(ctx: RequestContext, query: { squad?: Squad }): Promise<FixturesPayload>;
  getMatchCentre(ctx: RequestContext, fixtureId: string): Promise<MatchCentrePayload>;
  /** Without an id, the guide for the featured fixture. */
  getMatchday(ctx: RequestContext, fixtureId?: string): Promise<MatchdayPayload>;
  getPassport(ctx: RequestContext): Promise<PassportPayload>;
  getFanZone(ctx: RequestContext): Promise<FanZonePayload>;
  submitFanActivity(ctx: RequestContext, activityId: string, input: unknown): Promise<SubmitResult>;
  withdrawSubmission(ctx: RequestContext, receiptId: string): Promise<boolean>;
  reportStory(ctx: RequestContext, storyId: string, reason: ReportReason): Promise<boolean>;
  listContent(
    ctx: RequestContext,
    query: { category?: ContentCategory; kind?: ContentKind },
  ): Promise<Sourced<ContentItem[]>>;
  getContent(ctx: RequestContext, id: string): Promise<Sourced<ContentItem>>;
  getClub(ctx: RequestContext): Promise<Sourced<ClubSection[]>>;
  getClubSection(ctx: RequestContext, id: string): Promise<ClubSectionPayload>;
  getPartnerWorld(ctx: RequestContext): Promise<PartnerWorldPayload>;
  getHelp(ctx: RequestContext): Promise<Sourced<Faq[]>>;
  getMedia(ctx: RequestContext): Promise<Sourced<MediaAsset[]>>;
  getNotificationPreferences(ctx: RequestContext): Promise<Sourced<NotificationPreferences>>;
  updateNotificationPreferences(
    ctx: RequestContext,
    preferences: NotificationPreferences,
  ): Promise<Sourced<NotificationPreferences>>;
}

/** Stable cache keys for the data layer. */
export const queryKeys = {
  all: ['scarlets'] as const,
  home: (ctx: RequestContext) =>
    ['scarlets', 'home', ctx.account.state, ctx.account.member] as const,
  fixtures: (squad?: Squad) => ['scarlets', 'fixtures', squad ?? 'all'] as const,
  matchCentre: (id: string) => ['scarlets', 'centre', id] as const,
  matchday: (id?: string) => ['scarlets', 'matchday', id ?? 'featured'] as const,
  passport: (ctx: RequestContext) =>
    ['scarlets', 'passport', ctx.account.userId ?? 'guest', ctx.account.member] as const,
  fanZone: (ctx: RequestContext) =>
    ['scarlets', 'fanzone', ctx.account.userId ?? ctx.account.deviceId] as const,
  content: (category?: string, kind?: string) =>
    ['scarlets', 'content', category ?? 'all', kind ?? 'all'] as const,
  contentItem: (id: string) => ['scarlets', 'content-item', id] as const,
  club: ['scarlets', 'club'] as const,
  clubSection: (id: string) => ['scarlets', 'club', id] as const,
  partnerWorld: ['scarlets', 'partners'] as const,
  help: ['scarlets', 'help'] as const,
  media: ['scarlets', 'media'] as const,
  notifications: (ctx: RequestContext) =>
    ['scarlets', 'notifications', ctx.account.userId ?? ctx.account.deviceId] as const,
};
