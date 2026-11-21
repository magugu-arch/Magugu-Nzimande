import type { ZodType } from 'zod';
import type { ScarletsApi, RequestContext } from './api';
import {
  clubPayload,
  clubSectionPayload,
  contentListPayload,
  contentPayload,
  fanZonePayload,
  fixturesPayload,
  helpPayload,
  homePayload,
  matchCentrePayload,
  matchdayPayload,
  mediaPayload,
  notificationPayload,
  partnerWorldPayload,
  passportPayload,
  routes,
  submitResult,
} from './contracts';
import { z } from 'zod';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly kind: 'network' | 'http' | 'contract',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface HttpApiOptions {
  baseUrl: string;
  fetch?: typeof fetch;
  /** Supporter session token. The app holds no vendor secret of any kind. */
  getAccessToken?: () => Promise<string | null>;
  /** Stable per-install id, sent so one-vote-per-device rules hold for guests. */
  deviceId: string;
}

const fill = (path: string, params: Record<string, string>) =>
  path.replace(/:(\w+)/g, (_match, key: string) => encodeURIComponent(params[key] ?? ''));

/**
 * HTTP implementation of the API. Every response is parsed against its
 * schema: a payload that breaks the contract is an error, never a
 * half-rendered screen.
 */
export function createHttpApi(options: HttpApiOptions): ScarletsApi {
  const doFetch = options.fetch ?? fetch;

  async function call<T>(
    ctx: RequestContext,
    route: { method: string; path: string },
    schema: ZodType<T>,
    init: {
      params?: Record<string, string>;
      query?: Record<string, string | undefined>;
      body?: unknown;
    } = {},
  ): Promise<T> {
    const url = new URL(fill(route.path, init.params ?? {}), options.baseUrl);
    for (const [key, value] of Object.entries(init.query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, value);
    }
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Accept-Language': ctx.locale,
      'X-Device-Id': options.deviceId,
    };
    const token = await options.getAccessToken?.();
    if (token) headers.Authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers['Content-Type'] = 'application/json';

    let response: Response;
    try {
      response = await doFetch(url.toString(), {
        method: route.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
    } catch (cause) {
      throw new ApiError(
        cause instanceof Error ? cause.message : 'Network request failed',
        0,
        'network',
      );
    }
    if (!response.ok)
      throw new ApiError(`Request failed with ${response.status}`, response.status, 'http');
    const parsed = schema.safeParse(await response.json());
    if (!parsed.success) {
      throw new ApiError(
        `Response did not match the contract for ${route.path}`,
        response.status,
        'contract',
      );
    }
    return parsed.data;
  }

  return {
    getHome: (ctx) => call(ctx, routes.home, homePayload),
    getFixtures: (ctx, { squad }) =>
      call(ctx, routes.fixtures, fixturesPayload, { query: { team: squad } }),
    getMatchCentre: (ctx, id) =>
      call(ctx, routes.matchCentre, matchCentrePayload, { params: { id } }),
    getMatchday: (ctx, fixtureId) =>
      call(ctx, routes.matchday, matchdayPayload, { params: { fixtureId: fixtureId ?? 'next' } }),
    getPassport: (ctx) => call(ctx, routes.passport, passportPayload),
    getFanZone: (ctx) => call(ctx, routes.fanZone, fanZonePayload),
    submitFanActivity: (ctx, activityId, input) =>
      call(ctx, routes.fanZoneSubmit, submitResult, { params: { activityId }, body: input }),
    withdrawSubmission: (ctx, receiptId) =>
      call(ctx, routes.fanZoneWithdraw, z.boolean(), { params: { receiptId } }),
    reportStory: (ctx, storyId, reason) =>
      call(ctx, routes.storyReport, z.boolean(), { params: { storyId }, body: { reason } }),
    listContent: (ctx, { category, kind }) =>
      call(ctx, routes.content, contentListPayload, {
        query: { category, kind, lang: ctx.locale },
      }),
    getContent: (ctx, id) => call(ctx, routes.contentItem, contentPayload, { params: { id } }),
    getClub: (ctx) => call(ctx, routes.club, clubPayload),
    getClubSection: (ctx, id) =>
      call(ctx, routes.clubSection, clubSectionPayload, { params: { id } }),
    getPartnerWorld: (ctx) => call(ctx, routes.partnerWorld, partnerWorldPayload),
    getHelp: (ctx) => call(ctx, routes.help, helpPayload),
    getMedia: (ctx) => call(ctx, routes.media, mediaPayload),
    getNotificationPreferences: (ctx) =>
      call(ctx, routes.notificationPreferences, notificationPayload),
    updateNotificationPreferences: (ctx, preferences) =>
      call(ctx, routes.updateNotificationPreferences, notificationPayload, { body: preferences }),
  };
}
