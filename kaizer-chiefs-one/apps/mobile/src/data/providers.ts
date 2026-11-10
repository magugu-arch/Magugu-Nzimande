import {
  FEATURE_COPY,
  unavailable,
  type CapabilityMode,
  type CommerceProvider,
  type ContentProvider,
  type FanMomentsProvider,
  type Feature,
  type MatchDataProvider,
  type MembershipProvider,
  type RewardsProvider,
  type TicketProvider,
} from '@kc-one/contracts';
import { capabilities } from '@/config/env';
import { demoContent } from './demo/content';
import { demoMatchData } from './demo/football';
import { demoCommerce, demoMembership, demoRewards, demoTickets } from './demo/account';
import { demoFan } from './demo/fan';
import {
  liveCommerce,
  liveContent,
  liveFan,
  liveMatchData,
  liveMembership,
  liveRewards,
  liveTickets,
} from './live/adapters';

export interface Providers {
  content: ContentProvider;
  matchData: MatchDataProvider;
  membership: MembershipProvider;
  tickets: TicketProvider;
  rewards: RewardsProvider;
  commerce: CommerceProvider;
  fanMoments: FanMomentsProvider;
}

/** An adapter whose every method says the feature is switched off. */
function off<T extends object>(feature: Feature): T {
  const message = `${FEATURE_COPY[feature]} will appear here once the club connects it.`;
  return new Proxy({} as T, {
    get: () => async () => unavailable('integration_pending', message),
  });
}

function pick<T extends object>(feature: Feature, mode: CapabilityMode, demo: T, live: T): T {
  if (mode === 'demo') return demo;
  if (mode === 'live') return live;
  return off<T>(feature);
}

/**
 * The single place that decides which adapter serves each feature, from the
 * capability flags. Screens never import an adapter directly.
 */
export const providers: Providers = {
  content: pick('content', capabilities.content, demoContent, liveContent),
  matchData: pick('matchData', capabilities.matchData, demoMatchData, liveMatchData),
  membership: pick('membership', capabilities.membership, demoMembership, liveMembership),
  tickets: pick('tickets', capabilities.tickets, demoTickets, liveTickets),
  rewards: pick('rewards', capabilities.rewards, demoRewards, liveRewards),
  commerce: pick('commerce', capabilities.commerce, demoCommerce, liveCommerce),
  fanMoments: pick('fanMoments', capabilities.fanMoments, demoFan, liveFan),
};
