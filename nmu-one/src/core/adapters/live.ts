import { config, type AdapterDomain } from '../config';
import type { AppNotification } from '../domain/models';
import type { Providers } from './contracts';
import { AdapterError } from './errors';
import { connectivity } from './runtime';

/**
 * Production adapters: thin clients of the NMU ONE backend-for-frontend.
 *
 * The routes below are NMU ONE's *own* BFF contract (docs/INTEGRATIONS.md),
 * not NMU system endpoints — the BFF owns every credential and maps each
 * specialist system into the domain models. Until EXPO_PUBLIC_BFF_BASE_URL is
 * set, every call rejects with `not-configured`, so a live build can never
 * silently fall back to synthetic data (brief §8 "never present mock
 * financial information as live").
 */

let accessToken: () => string | null = () => null;

/** Wired by the session store so requests carry the current bearer token. */
export function setAccessTokenSource(source: () => string | null): void {
  accessToken = source;
}

const TIMEOUT_MS = 15_000;

async function request<T>(
  domain: AdapterDomain,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
): Promise<T> {
  if (!config.bffBaseUrl) throw new AdapterError('not-configured', domain, 'BFF base URL not set');
  if (!connectivity.isOnline()) throw new AdapterError('offline', domain);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const token = accessToken();
    const res = await fetch(`${config.bffBaseUrl}${path}`, {
      method,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 401) throw new AdapterError('unauthorised', domain);
    if (res.status === 403) throw new AdapterError('forbidden', domain);
    if (res.status === 404) throw new AdapterError('not-found', domain);
    if (res.status === 409) throw new AdapterError('conflict', domain);
    if (res.status === 400 || res.status === 422) throw new AdapterError('invalid', domain);
    if (!res.ok) throw new AdapterError('unavailable', domain, `HTTP ${res.status}`);
    return (res.status === 204 ? undefined : await res.json()) as T;
  } catch (e) {
    if (e instanceof AdapterError) throw e;
    throw new AdapterError(connectivity.isOnline() ? 'unavailable' : 'offline', domain);
  } finally {
    clearTimeout(timer);
  }
}

const q = (params: Record<string, string>) => `?${new URLSearchParams(params).toString()}`;
const get = <T>(d: AdapterDomain, p: string) => request<T>(d, 'GET', p);
const post = <T>(d: AdapterDomain, p: string, b?: unknown) => request<T>(d, 'POST', p, b ?? {});
const enc = encodeURIComponent;

export function createLiveProviders(): Providers {
  return {
    auth: {
      // Live sign-in is an OIDC authorization-code + PKCE flow against NMU SSO,
      // completed by the BFF (see INTEGRATIONS.md §Identity). The persona
      // argument exists for demos only and is ignored here.
      signIn: () => post('auth', '/v1/auth/session'),
      refresh: (session) =>
        post('auth', '/v1/auth/refresh', { refreshToken: session.refreshToken }),
      signOut: () => post('auth', '/v1/auth/sign-out'),
      getStudentProfile: () => get('auth', '/v1/me/student'),
      getStaffProfile: () => get('auth', '/v1/me/staff'),
      transitionToAlumni: () => post('auth', '/v1/me/lifecycle/alumni'),
    },
    academic: {
      getTimetable: (r) => get('academic', `/v1/academic/timetable${q(r)}`),
      getTeachingTimetable: (r) => get('academic', `/v1/academic/teaching${q(r)}`),
      getExams: () => get('academic', '/v1/academic/assessments'),
      getResults: () => get('academic', '/v1/academic/results'),
      getProgress: () => get('academic', '/v1/academic/progress'),
      getModules: () => get('academic', '/v1/academic/modules'),
      getAcademicCalendar: () => get('academic', '/v1/academic/calendar'),
    },
    learning: {
      getLinks: (code) => get('learning', `/v1/learning/modules/${enc(code)}/links`),
    },
    finance: {
      getAccount: () => get('finance', '/v1/finance/account'),
      getTransactions: () => get('finance', '/v1/finance/transactions'),
      getFunding: () => get('finance', '/v1/finance/funding'),
      createPayment: (input) => post('finance', '/v1/payments', input),
      confirmPayment: (id) => post('finance', `/v1/payments/${enc(id)}/confirm`),
      getReceipt: (id) => get('finance', `/v1/payments/receipts/${enc(id)}`),
    },
    library: {
      search: (query) => get('library', `/v1/library/search${q({ q: query })}`),
      getStudySpaces: (day) => get('library', `/v1/library/spaces${q({ day })}`),
      bookStudySpace: (input) => post('library', '/v1/library/bookings', input),
      getBookings: () => get('library', '/v1/library/bookings'),
      cancelBooking: (id) => post('library', `/v1/library/bookings/${enc(id)}/cancel`),
    },
    transport: {
      getRoutes: () => get('transport', '/v1/transport/routes'),
      getArrivals: (stopId) =>
        get('transport', `/v1/transport/arrivals${stopId ? q({ stop: stopId }) : ''}`),
      getDisruptions: () => get('transport', '/v1/transport/disruptions'),
    },
    residence: {
      getResidence: () => get('residence', '/v1/residence'),
      submitRequest: (input) => post('residence', '/v1/residence/requests', input),
    },
    campus: {
      getMap: () => get('campus', '/v1/campus/map'),
      getDirectory: () => get('campus', '/v1/campus/directory'),
    },
    commerce: {
      getVendors: () => get('commerce', '/v1/commerce/vendors'),
      getMenu: (id) => get('commerce', `/v1/commerce/vendors/${enc(id)}/menu`),
      placeOrder: (input) => post('commerce', '/v1/commerce/orders', input),
      getOrder: (id) => get('commerce', `/v1/commerce/orders/${enc(id)}`),
      getOrders: () => get('commerce', '/v1/commerce/orders'),
    },
    community: {
      getEvents: () => get('community', '/v1/events'),
      getEvent: (id) => get('community', `/v1/events/${enc(id)}`),
      bookTicket: (eventId, paymentId) =>
        post('community', `/v1/events/${enc(eventId)}/tickets`, { paymentId }),
      getTickets: () => get('community', '/v1/me/tickets'),
      getSocieties: () => get('community', '/v1/societies'),
      joinSociety: (id) => post('community', `/v1/societies/${enc(id)}/membership`),
    },
    notifications: {
      list: () => get('notifications', '/v1/notifications'),
      markRead: (id) => post('notifications', `/v1/notifications/${enc(id)}/read`),
      markAllRead: () => post('notifications', '/v1/notifications/read-all'),
      // Live delivery arrives by push (expo-notifications) and is merged by
      // the notification feature; there is no socket to subscribe to here.
      subscribe: (_listener: (n: AppNotification) => void) => () => undefined,
    },
    support: {
      getSafetyContacts: () => get('support', '/v1/support/safety-contacts'),
      getWellbeingServices: () => get('support', '/v1/support/wellbeing'),
      getSupportRoutes: () => get('support', '/v1/support/routes'),
      startLocationShare: (input) => post('support', '/v1/safety/location-shares', input),
      stopLocationShare: (id) => post('support', `/v1/safety/location-shares/${enc(id)}/stop`),
      getKnowledge: () => get('support', '/v1/content/knowledge'),
    },
    guardian: {
      getProfile: () => get('guardian', '/v1/guardian'),
      getUpdates: (id) => get('guardian', `/v1/guardian/students/${enc(id)}/updates`),
      getStudentAccount: (id) => get('guardian', `/v1/guardian/students/${enc(id)}/fees`),
      getMyGuardians: () => get('guardian', '/v1/me/guardians'),
      setGuardianSharing: (id, sharing) =>
        post('guardian', `/v1/me/guardians/${enc(id)}/sharing`, { sharing }),
    },
    alumni: {
      getProfile: () => get('alumni', '/v1/alumni/profile'),
      getMentoring: () => get('alumni', '/v1/alumni/mentoring'),
      respondToMentoring: (id, accept) =>
        post('alumni', `/v1/alumni/mentoring/${enc(id)}`, { accept }),
      getJobs: () => get('alumni', '/v1/alumni/jobs'),
      getCampaigns: () => get('alumni', '/v1/giving/campaigns'),
      pledge: (input) => post('alumni', '/v1/giving/pledges', input),
      getStories: () => get('alumni', '/v1/alumni/stories'),
      getChapters: () => get('alumni', '/v1/alumni/chapters'),
    },
  };
}
