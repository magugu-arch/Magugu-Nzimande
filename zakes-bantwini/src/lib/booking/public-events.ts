import 'server-only';
import { getStore, StoreNotConfigured } from '@/lib/store';
import { todayIso } from './dates';
import type { EventRecord } from './types';

export type PublicEventsResult = { events: EventRecord[]; unavailable: boolean };

/**
 * Upcoming, published public shows. Management adds them in the admin; nothing
 * is seeded, because the brief forbids inventing event dates. If the store is
 * not reachable the page says so, rather than claiming there are no dates.
 */
export async function upcomingPublicEvents(limit?: number): Promise<PublicEventsResult> {
  try {
    const events = await getStore().list('events', {
      where: { kind: 'public', published: true },
      range: { field: 'date', from: todayIso() },
      orderBy: { field: 'date', dir: 'asc' },
      limit,
    });
    return { events, unavailable: false };
  } catch (error) {
    if (!(error instanceof StoreNotConfigured)) console.error('[live] could not load events', error);
    return { events: [], unavailable: true };
  }
}

export async function publicEvent(id: string): Promise<EventRecord | null> {
  try {
    const event = await getStore().get('events', id);
    return event && event.kind === 'public' && event.published ? event : null;
  } catch {
    return null;
  }
}
