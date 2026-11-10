import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import {
  unavailable,
  type FanPostDraft,
  type FanReport,
  type ProviderResult,
  type TeamId,
} from '@kc-one/contracts';
import { useSession } from '@/state/session';
import { providers } from './providers';

/**
 * Application services as hooks. Each returns a ProviderResult, so screens
 * can render loading, unavailable, error and ok states without knowing which
 * adapter answered.
 */
export const keys = {
  home: ['home'] as const,
  article: (id: string) => ['article', id] as const,
  fixtures: ['fixtures'] as const,
  match: (id: string) => ['match', id] as const,
  squad: (t: TeamId) => ['squad', t] as const,
  member: (u: string | null) => ['member', u] as const,
  entitlements: (u: string | null) => ['entitlements', u] as const,
  tickets: (u: string | null) => ['tickets', u] as const,
  wallet: (u: string | null) => ['wallet', u] as const,
  rewards: ['rewards'] as const,
  products: ['products'] as const,
  fanFeed: ['fan', 'feed'] as const,
  fanMine: (u: string | null) => ['fan', 'mine', u] as const,
};

function useUserId() {
  return useSession((s) => s.session?.userId ?? null);
}

function signedIn<T>(userId: string | null, run: (id: string) => Promise<ProviderResult<T>>) {
  return userId
    ? run(userId)
    : Promise.resolve(unavailable<T>('not_authenticated', 'Sign in to see this.'));
}

/** Season window for fixtures: a year either side of today. */
function seasonRange() {
  const now = Date.now();
  const year = 365 * 24 * 3_600_000;
  return { from: new Date(now - year).toISOString(), to: new Date(now + year).toISOString() };
}

export const useHomeFeed = () =>
  useQuery({ queryKey: keys.home, queryFn: () => providers.content.getHomeFeed() });
export const useArticle = (id: string) =>
  useQuery({ queryKey: keys.article(id), queryFn: () => providers.content.getArticle(id) });

export const useFixtures = () =>
  useQuery({
    queryKey: keys.fixtures,
    queryFn: () => providers.matchData.getFixtures(seasonRange()),
  });
export const useMatch = (id: string) =>
  useQuery({
    queryKey: keys.match(id),
    queryFn: () => providers.matchData.getMatch(id),
    // Live matches refresh every 30s; anything else is fetched on demand.
    refetchInterval: (q) => {
      const d = q.state.data;
      return d?.status === 'ok' && d.provenance.state === 'live' && d.data.fixture.status === 'live'
        ? 30_000
        : false;
    },
  });
export const useSquad = (teamId: TeamId) =>
  useQuery({ queryKey: keys.squad(teamId), queryFn: () => providers.matchData.getSquad(teamId) });

export function useMember() {
  const u = useUserId();
  return useQuery({
    queryKey: keys.member(u),
    queryFn: () => signedIn(u, (id) => providers.membership.getMember(id)),
  });
}
export function useEntitlements() {
  const u = useUserId();
  return useQuery({
    queryKey: keys.entitlements(u),
    queryFn: () => signedIn(u, (id) => providers.membership.getEntitlements(id)),
  });
}

export function useTickets() {
  const u = useUserId();
  return useQuery({
    queryKey: keys.tickets(u),
    queryFn: () => signedIn(u, (id) => providers.tickets.listTickets(id)),
  });
}

/** Entry tokens are fetched at the moment of display and never cached. */
export function useSecureTicket(ticketId: string, enabled: boolean) {
  return useQuery({
    queryKey: ['secure-ticket', ticketId],
    queryFn: () => providers.tickets.getSecureTicket(ticketId),
    enabled,
    gcTime: 0,
    staleTime: 0,
    retry: false,
  });
}

export function useWallet() {
  const u = useUserId();
  return useQuery({
    queryKey: keys.wallet(u),
    queryFn: () => signedIn(u, (id) => providers.rewards.getWallet(id)),
  });
}
export const useRewards = () =>
  useQuery({ queryKey: keys.rewards, queryFn: () => providers.rewards.listRewards() });

/**
 * One idempotency key per redemption attempt, created before the request and
 * reused on retry, so a double tap or a dropped connection cannot redeem twice.
 */
export function useRedeem(rewardId: string) {
  const u = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (idempotencyKey: string) =>
      signedIn(u, (id) => providers.rewards.redeem(id, rewardId, idempotencyKey)),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.wallet(u) }),
  });
}
export const newIdempotencyKey = () => Crypto.randomUUID();

export const useProducts = () =>
  useQuery({ queryKey: keys.products, queryFn: () => providers.commerce.getProducts() });

export const useFanFeed = () =>
  useQuery({ queryKey: keys.fanFeed, queryFn: () => providers.fanMoments.listFeed() });
export function useMyFanPosts() {
  const u = useUserId();
  return useQuery({
    queryKey: keys.fanMine(u),
    queryFn: () => signedIn(u, (id) => providers.fanMoments.listMine(id)),
  });
}

export function useSubmitFanPost() {
  const u = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ draft, uri }: { draft: FanPostDraft; uri: string }) =>
      signedIn(u, (id) => providers.fanMoments.submit(id, draft, uri)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.fanMine(u) }),
  });
}

export function useRemoveFanPost() {
  const u = useUserId();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => signedIn(u, (id) => providers.fanMoments.remove(id, postId)),
    onSuccess: () => qc.invalidateQueries({ queryKey: keys.fanMine(u) }),
  });
}

export function useReportFanPost() {
  const u = useUserId();
  return useMutation({
    mutationFn: (report: FanReport) => signedIn(u, (id) => providers.fanMoments.report(id, report)),
  });
}
