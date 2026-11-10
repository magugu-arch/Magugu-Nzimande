import { z } from 'zod';
import {
  contentItemSchema,
  entitlementSchema,
  fanPostSchema,
  fixtureSchema,
  homeFeedSchema,
  matchSchema,
  memberAccountSchema,
  productSchema,
  redemptionSchema,
  rewardSchema,
  rewardWalletSchema,
  secureTicketSchema,
  squadSchema,
  ticketSummarySchema,
  unavailable,
  type CommerceProvider,
  type ContentProvider,
  type FanMomentsProvider,
  type MatchDataProvider,
  type MembershipProvider,
  type RewardsProvider,
  type TicketProvider,
} from '@kc-one/contracts';
import { callFunction } from './edge';

/**
 * Live adapters. Thin by design: each calls one server-side function, whose
 * contract is documented in docs/integration-contracts.md. The server, not
 * this app, talks to the club's CMS, match feed, CRM, ticketing, shop and
 * rewards providers.
 */

export const liveContent: ContentProvider = {
  getHomeFeed: () => callFunction('content', '/home', homeFeedSchema),
  getArticle: (id) =>
    callFunction('content', `/items/${encodeURIComponent(id)}`, contentItemSchema),
};

export const liveMatchData: MatchDataProvider = {
  getFixtures: (range) =>
    callFunction(
      'match-data',
      `/fixtures?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
      z.array(fixtureSchema),
    ),
  getMatch: (id) => callFunction('match-data', `/matches/${encodeURIComponent(id)}`, matchSchema),
  getSquad: (teamId) => callFunction('match-data', `/squads/${teamId}`, squadSchema),
};

export const liveMembership: MembershipProvider = {
  getMember: () => callFunction('membership', '/me', memberAccountSchema),
  getEntitlements: () => callFunction('membership', '/me/entitlements', z.array(entitlementSchema)),
};

export const liveTickets: TicketProvider = {
  listTickets: () => callFunction('tickets', '/me', z.array(ticketSummarySchema)),
  // Short timeout: a stale entry code is worse than a retry at the gate.
  getSecureTicket: (id) =>
    callFunction('tickets', `/me/${encodeURIComponent(id)}/secure`, secureTicketSchema, {
      timeoutMs: 8_000,
    }),
};

export const liveRewards: RewardsProvider = {
  getWallet: () => callFunction('rewards', '/me/wallet', rewardWalletSchema),
  listRewards: () => callFunction('rewards', '/catalog', z.array(rewardSchema)),
  redeem: (_userId, rewardId, idempotencyKey) =>
    callFunction('rewards', '/me/redemptions', redemptionSchema, {
      method: 'POST',
      body: { rewardId },
      idempotencyKey,
    }),
};

export const liveCommerce: CommerceProvider = {
  getProducts: () => callFunction('commerce', '/products', z.array(productSchema)),
  getProductLink: (id) =>
    callFunction(
      'commerce',
      `/products/${encodeURIComponent(id)}/link`,
      z.object({ url: z.url() }),
    ),
};

export const liveFan: FanMomentsProvider = {
  listFeed: () => callFunction('fan-moments', '/feed', z.array(fanPostSchema)),
  listMine: () => callFunction('fan-moments', '/me', z.array(fanPostSchema)),
  // Upload needs a signed upload URL from the server, then the bytes go to
  // private storage, then the server scans and queues the post. Wired once the
  // backend is approved; until then the live adapter says so plainly.
  submit: async () =>
    unavailable(
      'integration_pending',
      'Uploading needs the club’s approved storage and moderation service.',
    ),
  remove: (_userId, postId) =>
    callFunction(
      'fan-moments',
      `/me/${encodeURIComponent(postId)}`,
      z.object({ removed: z.literal(true) }),
      {
        method: 'DELETE',
      },
    ),
  report: (_userId, report) =>
    callFunction('fan-moments', '/reports', z.object({ received: z.literal(true) }), {
      method: 'POST',
      body: report,
    }),
};
