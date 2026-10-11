import catalogue from '@data/sample-catalogue.json';
import { EVENT_TIME_ZONE } from '@/domain/events';
import type { BrandEvent, EventKind, Rsvp, RsvpPolicy } from '@/domain/types';
import type { EventsProvider, RsvpRequest } from './EventsProvider';

type SampleEvent = (typeof catalogue.events)[number];

function hash(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) % 9973;
  return n;
}

/**
 * Sample fixtures for the concept build, dated relative to today so the
 * calendar never goes stale. Capacity is held here, out of the app's sight;
 * a full evening puts new guests on the waitlist, an invited evening takes
 * requests only, and a drop-in needs no place at all.
 */
export class MockEventsProvider implements EventsProvider {
  readonly id = 'mock';
  readonly isMock = true;
  readonly timeZone = EVENT_TIME_ZONE;
  private reserved = new Map<string, number>();
  private rsvps = new Map<string, Rsvp>();
  private byKey = new Map<string, Rsvp>();

  constructor(private readonly today: Date = new Date()) {
    for (const e of catalogue.events) this.reserved.set(e.id, e.reserved ?? 0);
  }

  private toEvent(e: SampleEvent): BrandEvent {
    // The sample day in South Africa, then the local start time there (UTC+2).
    const base = new Date(this.today.getTime() + 2 * 3600 * 1000);
    const day = new Date(
      Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + e.startsInDays),
    )
      .toISOString()
      .slice(0, 10);
    const starts = new Date(`${day}T${e.startTime}:00+02:00`);
    const ends = new Date(starts.getTime() + e.durationMinutes * 60000);
    const kind = catalogue.eventKinds[e.kind as EventKind];
    const rsvp = e.rsvp as RsvpPolicy;
    const left = (e.capacity ?? Infinity) - (this.reserved.get(e.id) ?? 0);
    return {
      id: e.id,
      title: e.title,
      kind: e.kind as EventKind,
      kindLabel: kind.label,
      place: kind.place,
      city: e.city,
      startsAt: starts.toISOString(),
      endsAt: ends.toISOString(),
      timeZone: this.timeZone,
      rsvp,
      availability: rsvp === 'open' ? (left > 0 ? 'open' : 'full') : rsvp,
      heroAssetId: e.hero,
      productIds: e.products,
      summary: e.summary,
      sample: true,
    };
  }

  async listEvents(): Promise<BrandEvent[]> {
    return catalogue.events
      .map((e) => this.toEvent(e))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  }

  async getEvent(id: string): Promise<BrandEvent | undefined> {
    const e = catalogue.events.find((x) => x.id === id);
    return e ? this.toEvent(e) : undefined;
  }

  async listRsvps(): Promise<Rsvp[]> {
    return [...this.rsvps.values()];
  }

  async rsvp(request: RsvpRequest, idempotencyKey: string): Promise<Rsvp> {
    const repeat = this.byKey.get(idempotencyKey);
    if (repeat) return repeat;
    const existing = this.rsvps.get(request.eventId);
    if (existing) return existing;
    const sample = catalogue.events.find((x) => x.id === request.eventId);
    if (!sample) throw new Error('That event is no longer listed.');
    const event = this.toEvent(sample);
    if (new Date(event.endsAt).getTime() < Date.now())
      throw new Error('This event has already taken place.');

    const guests = event.rsvp === 'invite-only' ? 1 : request.guests;
    let status: Rsvp['status'];
    if (event.rsvp === 'invite-only') status = 'requested';
    else if (event.rsvp === 'drop-in') status = 'going';
    else {
      const left = (sample.capacity ?? Infinity) - (this.reserved.get(sample.id) ?? 0);
      status = left >= guests ? 'going' : 'waitlist';
      if (status === 'going')
        this.reserved.set(sample.id, (this.reserved.get(sample.id) ?? 0) + guests);
    }
    const rsvp: Rsvp = {
      reference: `DEMO-RSVP-${String(1000 + ((hash(idempotencyKey) * 89) % 9000))}`,
      eventId: request.eventId,
      status,
      guests,
      updates: request.updates,
      createdAt: new Date().toISOString(),
    };
    this.rsvps.set(request.eventId, rsvp);
    this.byKey.set(idempotencyKey, rsvp);
    return rsvp;
  }

  async cancelRsvp(eventId: string): Promise<void> {
    const r = this.rsvps.get(eventId);
    if (!r) return;
    const sample = catalogue.events.find((x) => x.id === eventId);
    if (r.status === 'going' && sample?.rsvp === 'open')
      this.reserved.set(eventId, Math.max(0, (this.reserved.get(eventId) ?? 0) - r.guests));
    this.rsvps.delete(eventId);
  }
}
