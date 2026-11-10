import type { HomeFeed, ContentItem } from './content';
import type { Product } from './commerce';
import type { FanPost, FanPostDraft, FanReport } from './fan';
import type { DateRange, Fixture, Match, Squad, TeamId } from './football';
import type { Entitlement, MemberAccount } from './membership';
import type { Campaign } from './notifications';
import type { ProviderResult } from './result';
import type { Redemption, Reward, RewardWallet } from './rewards';
import type { SecureTicket, TicketSummary } from './tickets';

/**
 * Provider contracts. Screens call application services built on these, never
 * a third-party API. Each has a demo adapter (labelled, local only) and a live
 * adapter that calls a server-side function holding the real credentials.
 */

export interface ContentProvider {
  getHomeFeed(): Promise<ProviderResult<HomeFeed>>;
  getArticle(id: string): Promise<ProviderResult<ContentItem>>;
}

export interface MatchDataProvider {
  getFixtures(range: DateRange): Promise<ProviderResult<Fixture[]>>;
  getMatch(matchId: string): Promise<ProviderResult<Match>>;
  getSquad(teamId: TeamId): Promise<ProviderResult<Squad>>;
}

export interface MembershipProvider {
  getMember(userId: string): Promise<ProviderResult<MemberAccount>>;
  getEntitlements(userId: string): Promise<ProviderResult<Entitlement[]>>;
}

export interface TicketProvider {
  listTickets(userId: string): Promise<ProviderResult<TicketSummary[]>>;
  /** Fetches a short-lived entry token at the moment of display. Never cached. */
  getSecureTicket(ticketId: string): Promise<ProviderResult<SecureTicket>>;
}

export interface RewardsProvider {
  getWallet(userId: string): Promise<ProviderResult<RewardWallet>>;
  listRewards(): Promise<ProviderResult<Reward[]>>;
  redeem(
    userId: string,
    rewardId: string,
    idempotencyKey: string,
  ): Promise<ProviderResult<Redemption>>;
}

export interface CommerceProvider {
  getProducts(): Promise<ProviderResult<Product[]>>;
  getProductLink(productId: string): Promise<ProviderResult<{ url: string }>>;
}

export interface FanMomentsProvider {
  listFeed(): Promise<ProviderResult<FanPost[]>>;
  listMine(userId: string): Promise<ProviderResult<FanPost[]>>;
  submit(
    userId: string,
    draft: FanPostDraft,
    localMediaUri: string,
  ): Promise<ProviderResult<FanPost>>;
  remove(userId: string, postId: string): Promise<ProviderResult<{ removed: true }>>;
  report(userId: string, report: FanReport): Promise<ProviderResult<{ received: true }>>;
}

/** Server-side only: the admin portal schedules, the backend delivers. */
export interface NotificationProvider {
  sendCampaign(campaign: Campaign): Promise<ProviderResult<{ providerRef: string }>>;
}
