import type { AdminBooking, ContactMessage, OpeningHours, Service, ServiceUpdate } from '../../shared/types';
import { RequestError } from './api';

/**
 * Client for the studio dashboard. The admin token is kept in sessionStorage
 * only — it is gone when the tab closes — and sent as a Bearer header.
 */

const KEY = 'grateful:studio-token';

export const studioToken = {
  get(): string | null {
    try {
      return sessionStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null) {
    try {
      if (token) sessionStorage.setItem(KEY, token);
      else sessionStorage.removeItem(KEY);
    } catch {
      /* private mode: the user signs in again next time */
    }
  },
};

async function call<T>(method: string, path: string, body?: unknown, token = studioToken.get()): Promise<T> {
  const init: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token ?? ''}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
  let res: Response;
  try {
    res = import.meta.env.VITE_DEMO === 'true' ? await import('./demoApi').then((m) => m.demoFetch(`/api/admin${path}`, init)) : await fetch(`/api/admin${path}`, init);
  } catch {
    throw new RequestError('Could not reach the server. Check your connection and try again.', 0);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: string; fields?: Record<string, string> };
  if (!res.ok) throw new RequestError(data.error ?? 'Something went wrong.', res.status, data.fields);
  return data;
}

export type Overview = {
  today: string;
  todayCount: number;
  weekCount: number;
  needsAttention: number;
  awaitingPayment: number;
  newMessages: number;
  subscribers: number;
};

export const adminApi = {
  checkToken: (token: string) => call<{ ok: true }>('GET', '/session', undefined, token),
  overview: () => call<Overview>('GET', '/overview'),
  bookings: (from: string, to: string) => call<{ bookings: AdminBooking[] }>('GET', `/bookings?from=${from}&to=${to}`).then((r) => r.bookings),
  rescheduleOptions: (id: string, date: string) => call<{ slots: string[] }>('GET', `/bookings/${id}/options?date=${date}`).then((r) => r.slots),
  reschedule: (id: string, date: string, time: string) => call<unknown>('POST', `/bookings/${id}/reschedule`, { date, time }),
  cancel: (id: string) => call<unknown>('POST', `/bookings/${id}/cancel`),
  services: () => call<{ services: Service[] }>('GET', '/services').then((r) => r.services),
  updateService: (id: string, patch: ServiceUpdate) => call<{ service: Service }>('PATCH', `/services/${id}`, patch).then((r) => r.service),
  hours: (from: string, to: string) => call<{ hours: OpeningHours[] }>('GET', `/hours?from=${from}&to=${to}`).then((r) => r.hours),
  addHours: (body: { date?: string; from?: string; to?: string; weekdays?: number[]; startTime: string; endTime: string }) =>
    call<{ added: OpeningHours[]; skipped: string[] }>('POST', '/hours', body),
  setHoursStatus: (id: string, status: OpeningHours['status']) => call<unknown>('PATCH', `/hours/${id}`, { status }),
  deleteHours: (id: string) => call<unknown>('DELETE', `/hours/${id}`),
  messages: () => call<{ messages: ContactMessage[] }>('GET', '/messages').then((r) => r.messages),
  setMessageStatus: (id: string, status: ContactMessage['status']) => call<unknown>('PATCH', `/messages/${id}`, { status }),
};
