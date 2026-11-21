import type {
  Campaign,
  ClubSection,
  ContentCategory,
  ContentItem,
  ContentKind,
  FanActivity,
  Faq,
  Fixture,
  HospitalityPackage,
  Lineup,
  LocalizedText,
  MatchEvent,
  MatchStat,
  MatchdayGuide,
  MediaAsset,
  Membership,
  Partner,
  Passport,
  Receipt,
  ReportReason,
  Sourced,
  Squad,
  SubmitError,
  SupporterStory,
  Tally,
} from '@scarlets/domain';

/**
 * Provider contracts.
 *
 * Each interface is the seam where a club system plugs in. They are written
 * to run SERVER-SIDE (Supabase Edge Functions or the club's equivalent):
 * vendor credentials live there and never ship in the app. The app only ever
 * sees the normalised shapes from @scarlets/domain.
 *
 * Every read returns Sourced<T>: the data plus where it came from, when the
 * provider last confirmed it and whether it can be vouched for right now. A
 * provider that is down returns `data: null` with status "unavailable". It
 * never returns a guess.
 */

export interface Account {
  state: 'guest' | 'signed_in';
  /** Null for a guest. */
  userId: string | null;
  /** Stable per install: the unit for one-vote-per-device rules. */
  deviceId: string;
  /** Whether a verified membership is linked. Comes from the membership system. */
  member: boolean;
}

export interface TicketLink {
  url: string;
  label: LocalizedText;
  /** Where the link lands: a purchase journey or the supporter's ticket account. */
  kind: 'purchase' | 'account' | 'information';
}

export interface OfficialLink {
  url: string;
  label: LocalizedText;
  /** False while the club has not confirmed the exact destination. */
  confirmed: boolean;
}

export interface TicketingProvider {
  /** The official destination for a fixture's tickets. The app links out; it never sells. */
  getTicketLink(fixtureId: string): Promise<Sourced<TicketLink>>;
  /** The supporter's own ticket account, for digital tickets and wallet passes. */
  getAccountLink(): Promise<Sourced<TicketLink>>;
}

export interface TableRow {
  position: number;
  team: string;
  played: number;
  points: number;
}

export interface FixturesProvider {
  listFixtures(query: { squad?: Squad }): Promise<Sourced<Fixture[]>>;
  getFixture(id: string): Promise<Sourced<Fixture>>;
  /** Official standings only. Never computed from partial results. */
  getTable(squad: Squad): Promise<Sourced<TableRow[]>>;
}

export interface LiveMatchProvider {
  getTimeline(fixtureId: string): Promise<Sourced<MatchEvent[]>>;
  getLineups(fixtureId: string): Promise<Sourced<Lineup[]>>;
  getStats(fixtureId: string): Promise<Sourced<MatchStat[]>>;
}

export interface CMSProvider {
  listContent(query: {
    category?: ContentCategory;
    kind?: ContentKind;
    fixtureId?: string;
  }): Promise<Sourced<ContentItem[]>>;
  getContent(id: string): Promise<Sourced<ContentItem>>;
  getClubSection(id: string): Promise<Sourced<ClubSection>>;
  listClubSections(): Promise<Sourced<ClubSection[]>>;
  listFaqs(): Promise<Sourced<Faq[]>>;
  listMedia(): Promise<Sourced<MediaAsset[]>>;
}

export interface MembershipProvider {
  getMembership(account: Account): Promise<Sourced<Membership>>;
}

export interface RewardsProvider {
  /** Programme state, benefits, missions and history for one supporter. */
  getPassport(account: Account, membership: Membership): Promise<Sourced<Passport>>;
}

export interface CommerceProvider {
  getShopLink(): Promise<Sourced<OfficialLink>>;
}

export interface HospitalityProvider {
  listPackages(): Promise<Sourced<HospitalityPackage[]>>;
}

export interface NotificationPreferences {
  /** Service messages about a ticket or fixture the supporter chose to follow. */
  matchAlerts: boolean;
  ticketReminders: boolean;
  clubNews: boolean;
  /** Marketing consent is separate and off by default. */
  partnerOffers: boolean;
}

export interface NotificationProvider {
  getPreferences(account: Account): Promise<Sourced<NotificationPreferences>>;
  updatePreferences(
    account: Account,
    preferences: NotificationPreferences,
  ): Promise<Sourced<NotificationPreferences>>;
}

export interface VenueProvider {
  getGuide(fixtureId: string): Promise<Sourced<MatchdayGuide>>;
}

export interface PartnerProvider {
  listPartners(): Promise<Sourced<Partner[]>>;
  listCampaigns(): Promise<Sourced<Campaign[]>>;
}

export type SubmitResult = { ok: true; receipt: Receipt } | { ok: false; error: SubmitError };

export interface FanZoneProvider {
  listActivities(): Promise<Sourced<FanActivity[]>>;
  listReceipts(account: Account): Promise<Receipt[]>;
  submit(account: Account, activityId: string, input: unknown): Promise<SubmitResult>;
  /** Withdraw a supporter's own submission (and their consent with it). */
  withdraw(account: Account, receiptId: string): Promise<boolean>;
  pollResults(activityId: string): Promise<Sourced<Tally[]>>;
  listStories(account: Account): Promise<Sourced<SupporterStory[]>>;
  reportStory(account: Account, storyId: string, reason: ReportReason): Promise<boolean>;
}

export interface Adapters {
  ticketing: TicketingProvider;
  fixtures: FixturesProvider;
  liveMatch: LiveMatchProvider;
  cms: CMSProvider;
  membership: MembershipProvider;
  rewards: RewardsProvider;
  commerce: CommerceProvider;
  hospitality: HospitalityProvider;
  notifications: NotificationProvider;
  venue: VenueProvider;
  partners: PartnerProvider;
  fanZone: FanZoneProvider;
}

/** Minimal async key-value store, so demo state survives an app restart. */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export function memoryStore(): KeyValueStore {
  const map = new Map<string, string>();
  return {
    get: async (key) => map.get(key) ?? null,
    set: async (key, value) => {
      map.set(key, value);
    },
  };
}
