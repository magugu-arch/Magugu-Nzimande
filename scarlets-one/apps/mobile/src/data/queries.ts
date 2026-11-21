import type { NotificationPreferences } from '@scarlets/adapters';
import { queryKeys } from '@scarlets/api-client';
import type { ContentCategory, ContentKind, ReportReason, Squad } from '@scarlets/domain';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { demoNow, useDemo } from '@/state/demo';
import { useApi, useRequestContext } from './api';

/** Live data is refetched on a short interval; reference data is not. */
const LIVE_INTERVAL = 15_000;
const CALM_INTERVAL = 60_000;

/**
 * Every query key carries the demo scenario and provider switches, so
 * changing one in Demo controls refetches what it affects straight away.
 */
function useDemoKey(): string {
  return useDemo(
    (s) => `${s.scenario}:${s.startedAt}:${s.liveFeed}:${s.ticketing}:${s.rewards}:${s.network}`,
  );
}

export function useHome() {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.home(ctx), demo],
    queryFn: () => api.getHome(ctx),
    refetchInterval: (query) => {
      const phase = query.state.data?.phase;
      return phase === 'live' || phase === 'half_time' ? LIVE_INTERVAL : CALM_INTERVAL;
    },
  });
}

export function useFixtures(squad?: Squad) {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.fixtures(squad), demo],
    queryFn: () => api.getFixtures(ctx, { squad }),
    refetchInterval: CALM_INTERVAL,
  });
}

export function useMatchCentre(fixtureId: string) {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.matchCentre(fixtureId), demo],
    queryFn: () => api.getMatchCentre(ctx, fixtureId),
    refetchInterval: (query) => {
      const status = query.state.data?.fixture.data?.status;
      return status === 'live' || status === 'half_time' ? LIVE_INTERVAL : CALM_INTERVAL;
    },
  });
}

export function useMatchday(fixtureId?: string) {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.matchday(fixtureId), demo],
    queryFn: () => api.getMatchday(ctx, fixtureId),
    refetchInterval: CALM_INTERVAL,
  });
}

export function usePassport() {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.passport(ctx), demo],
    queryFn: () => api.getPassport(ctx),
  });
}

export function useFanZone() {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.fanZone(ctx), ctx.account.state, demo],
    queryFn: () => api.getFanZone(ctx),
    refetchInterval: CALM_INTERVAL,
  });
}

export function useSubmitFanActivity() {
  const api = useApi();
  const ctx = useRequestContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, input }: { activityId: string; input: unknown }) =>
      api.submitFanActivity(ctx, activityId, input),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

export function useWithdrawSubmission() {
  const api = useApi();
  const ctx = useRequestContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: (receiptId: string) => api.withdrawSubmission(ctx, receiptId),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

export function useReportStory() {
  const api = useApi();
  const ctx = useRequestContext();
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ storyId, reason }: { storyId: string; reason: ReportReason }) =>
      api.reportStory(ctx, storyId, reason),
    onSuccess: () => client.invalidateQueries({ queryKey: queryKeys.all }),
  });
}

export function useContentList(query: { category?: ContentCategory; kind?: ContentKind } = {}) {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.content(query.category, query.kind), demo],
    queryFn: () => api.listContent(ctx, query),
  });
}

export function useContentItem(id: string) {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.contentItem(id), demo],
    queryFn: () => api.getContent(ctx, id),
  });
}

export function useClub() {
  const api = useApi();
  const ctx = useRequestContext();
  return useQuery({ queryKey: queryKeys.club, queryFn: () => api.getClub(ctx) });
}

export function useClubSection(id: string) {
  const api = useApi();
  const ctx = useRequestContext();
  const demo = useDemoKey();
  return useQuery({
    queryKey: [...queryKeys.clubSection(id), demo],
    queryFn: () => api.getClubSection(ctx, id),
  });
}

export function usePartnerWorld() {
  const api = useApi();
  const ctx = useRequestContext();
  return useQuery({ queryKey: queryKeys.partnerWorld, queryFn: () => api.getPartnerWorld(ctx) });
}

export function useHelp() {
  const api = useApi();
  const ctx = useRequestContext();
  return useQuery({ queryKey: queryKeys.help, queryFn: () => api.getHelp(ctx) });
}

export function useMediaLibrary() {
  const api = useApi();
  const ctx = useRequestContext();
  return useQuery({ queryKey: queryKeys.media, queryFn: () => api.getMedia(ctx) });
}

export function useNotificationPreferences() {
  const api = useApi();
  const ctx = useRequestContext();
  const client = useQueryClient();
  const key = queryKeys.notifications(ctx);
  const query = useQuery({ queryKey: key, queryFn: () => api.getNotificationPreferences(ctx) });
  const mutation = useMutation({
    mutationFn: (preferences: NotificationPreferences) =>
      api.updateNotificationPreferences(ctx, preferences),
    // Show the change the instant the switch is flipped; roll back if it fails.
    onMutate: async (preferences) => {
      await client.cancelQueries({ queryKey: key });
      const previous = client.getQueryData(key);
      client.setQueryData(key, (old: typeof query.data) =>
        old ? { ...old, data: preferences } : old,
      );
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) client.setQueryData(key, context.previous);
    },
    onSettled: () => client.invalidateQueries({ queryKey: key }),
  });
  return { query, update: mutation.mutate };
}

/**
 * The demo clock, ticking. Countdowns and "opens in" labels read from here,
 * never from the device clock.
 */
export function useNow(intervalMs = 1000): Date {
  const scenario = useDemo((s) => `${s.scenario}:${s.startedAt}`);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  // Recomputed on every tick and whenever the scenario changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => demoNow(), [tick, scenario]);
}
