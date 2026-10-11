import { useMemo } from 'react';
import { EVENT_TIME_ZONE, isPast } from '@/domain/events';
import type { BrandEvent, Rsvp } from '@/domain/types';
import { providers } from '@/providers';
import { useEventsState } from '@/store/events';
import { useAsync } from './async';
import { useMarket } from './catalogue';

const { events } = providers;

/**
 * Fixtures plus the guest's RSVPs, and the moment they were read — "past" and
 * "upcoming" are judged against that, not against a clock read during render.
 */
export function useEvents() {
  const revision = useEventsState((s) => s.revision);
  return useAsync(async () => {
    const [list, rsvps] = await Promise.all([events.listEvents(), events.listRsvps()]);
    return { list, rsvps, now: new Date() };
  }, [revision]);
}

export function useEvent(id: string) {
  const revision = useEventsState((s) => s.revision);
  return useAsync(async () => {
    const [event, rsvps] = await Promise.all([events.getEvent(id), events.listRsvps()]);
    return { event, rsvp: rsvps.find((r) => r.eventId === id), now: new Date() };
  }, [id, revision]);
}

export type EventTone = 'ok' | 'warn' | 'info' | 'neutral';

/** What the event's state is, in words — never a count of places left. */
export function eventStatus(
  e: BrandEvent,
  now: Date,
): { tone: EventTone; label: string; icon: 'checkmark' | 'time-outline' | 'shield-outline' } {
  if (isPast(e, now)) return { tone: 'neutral', label: 'Past event', icon: 'time-outline' };
  switch (e.availability) {
    case 'invite-only':
      return { tone: 'info', label: 'By invitation', icon: 'shield-outline' };
    case 'drop-in':
      return { tone: 'ok', label: 'Drop in', icon: 'checkmark' };
    case 'full':
      return { tone: 'warn', label: 'Waitlist open', icon: 'time-outline' };
    default:
      return { tone: 'ok', label: 'Spaces available', icon: 'checkmark' };
  }
}

export function rsvpLabel(r: Rsvp): { tone: EventTone; label: string } {
  if (r.status === 'going')
    return { tone: 'ok', label: r.guests > 1 ? 'You’re going · +1' : 'You’re going' };
  if (r.status === 'waitlist') return { tone: 'warn', label: 'On the waitlist' };
  return { tone: 'info', label: 'Invitation requested' };
}

/** "Fri, 23 Oct, 18:30–21:00 SAST", or a date range for a multi-day pop-up. */
export function useEventDate(): (e: BrandEvent) => string {
  const market = useMarket();
  return useMemo(() => {
    const fmt = (d: Date, o: Intl.DateTimeFormatOptions) => {
      try {
        return new Intl.DateTimeFormat(market.locale, { ...o, timeZone: EVENT_TIME_ZONE }).format(
          d,
        );
      } catch {
        return d.toISOString().slice(0, 16).replace('T', ' ');
      }
    };
    return (e: BrandEvent) => {
      const s = new Date(e.startsAt);
      const end = new Date(e.endsAt);
      const day = { weekday: 'short', day: 'numeric', month: 'short' } as const;
      const time = { hour: '2-digit', minute: '2-digit' } as const;
      if (end.getTime() - s.getTime() > 24 * 3600 * 1000)
        return `${fmt(s, day)} – ${fmt(end, day)}`;
      return `${fmt(s, day)}, ${fmt(s, time)}–${fmt(end, time)} SAST`;
    };
  }, [market.locale]);
}

/** The start in the customer's own zone, when that differs from South Africa's. */
export function localStart(e: BrandEvent, locale: string): string | null {
  try {
    const here = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (here === EVENT_TIME_ZONE || e.kind === 'popup' || e.kind === 'trunk') return null;
    return new Intl.DateTimeFormat(locale, {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    }).format(new Date(e.startsAt));
  } catch {
    return null;
  }
}

/** The invite text a guest sends a friend. */
export function inviteMessage(e: BrandEvent, date: string): string {
  return `${e.title} — ${date}, ${e.city}. Come with me?${
    e.sample ? ' (MAXHOSA AFRICA concept demo — sample event.)' : ''
  }`;
}

/** What the event page's main button does, in the guest's terms. */
export function primaryLabel(event: BrandEvent, rsvp: Rsvp | undefined): string {
  if (rsvp) return rsvp.status === 'requested' ? 'Invitation requested' : 'Add to calendar';
  return rsvpTitle(event);
}

/** The RSVP sheet's title and the event page's call to action, before replying. */
export function rsvpTitle(event: BrandEvent): string {
  if (event.rsvp === 'invite-only') return 'Request an invitation';
  if (event.rsvp === 'drop-in') return event.kind === 'trunk' ? 'Reserve a fitting' : 'I’m going';
  return event.availability === 'full' ? 'Join the waitlist' : 'RSVP';
}
