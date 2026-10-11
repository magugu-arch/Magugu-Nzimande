import {
  buildIcs,
  eventDayKeys,
  eventsByDay,
  icsFold,
  isPast,
  monthGrid,
  nextEventFor,
  sastDayKey,
  upcoming,
} from '@/domain/events';
import { eventStatus, primaryLabel, rsvpLabel } from '@/features/events';
import { MockEventsProvider } from '@/providers/events/MockEventsProvider';
import catalogue from '@data/sample-catalogue.json';

const TODAY = new Date('2026-10-11T08:00:00Z');
const request = (eventId: string, guests: 1 | 2 = 1) => ({
  eventId,
  guests,
  name: 'Sample Guest',
  email: 'guest@example.com',
  updates: true,
});

describe('event dates', () => {
  it('counts days in South African time, whatever the instant', () => {
    expect(sastDayKey('2026-10-11T21:59:00Z')).toBe('2026-10-11');
    expect(sastDayKey('2026-10-11T22:00:00Z')).toBe('2026-10-12');
  });

  it('marks every day a multi-day pop-up touches', () => {
    const keys = eventDayKeys({
      startsAt: '2026-11-21T08:00:00.000Z',
      endsAt: '2026-11-22T20:00:00.000Z',
    });
    expect(keys).toEqual(['2026-11-21', '2026-11-22']);
  });

  it('lays a month out Monday first, padded to whole weeks', () => {
    const oct = monthGrid(2026, 9); // 1 October 2026 is a Thursday
    expect(oct.slice(0, 4)).toEqual([null, null, null, '2026-10-01']);
    expect(oct.length % 7).toBe(0);
    expect(oct.filter(Boolean)).toHaveLength(31);
  });
});

describe('calendar file', () => {
  it('is valid iCalendar with UTC times, and says it is a sample', async () => {
    const ev01 = (await new MockEventsProvider(TODAY).getEvent('ev01'))!;
    const ics = buildIcs([ev01], TODAY);
    expect(ics.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(ics.trimEnd().endsWith('END:VCALENDAR')).toBe(true);
    // ev01 starts at 18:30 SAST, 16:30 UTC.
    expect(ics).toMatch(/DTSTART:\d{8}T163000Z/);
    expect(ics).toContain('(sample event)');
    expect(ics).not.toMatch(/LOCATION:[^\r]*\d+ [A-Z][a-z]+ (Street|Road|Avenue)/);
  });

  it('folds long lines at 75 octets without splitting a character', () => {
    const line = `SUMMARY:${'Sunset knitwear soirée — '.repeat(6)}`;
    const folded = icsFold(line).split('\r\n');
    expect(folded.length).toBeGreaterThan(1);
    for (const l of folded) expect(Buffer.byteLength(l, 'utf8')).toBeLessThanOrEqual(75);
    expect(folded.map((l, i) => (i ? l.slice(1) : l)).join('')).toBe(line);
  });
});

describe('MockEventsProvider', () => {
  it('lists sample fixtures relative to today, soonest first, never with a head-count', async () => {
    const events = await new MockEventsProvider(TODAY).listEvents();
    expect(events.every((e) => e.sample)).toBe(true);
    expect(events.map((e) => e.startsAt)).toEqual([...events.map((e) => e.startsAt)].sort());
    for (const e of events) {
      expect(e).not.toHaveProperty('capacity');
      expect(e).not.toHaveProperty('reserved');
    }
    const past = events.filter((e) => isPast(e, TODAY));
    expect(past.map((e) => e.id)).toEqual(['ev08']);
    expect(upcoming(events, TODAY)[0]!.id).toBe('ev01');
  });

  it('holds a place, and the same key twice holds it once', async () => {
    const p = new MockEventsProvider(TODAY);
    const a = await p.rsvp(request('ev01', 2), 'k1');
    const b = await p.rsvp(request('ev01', 2), 'k1');
    expect(a.status).toBe('going');
    expect(b).toBe(a);
    expect(await p.listRsvps()).toHaveLength(1);
  });

  it('puts guests on the waitlist when the evening is full', async () => {
    const p = new MockEventsProvider(TODAY);
    expect((await p.getEvent('ev02'))!.availability).toBe('full');
    expect((await p.rsvp(request('ev02'), 'k2')).status).toBe('waitlist');
  });

  it('releasing a place frees it for the next guest', async () => {
    const p = new MockEventsProvider(TODAY);
    await p.rsvp(request('ev01', 2), 'mine');
    await p.cancelRsvp('ev01');
    expect(await p.listRsvps()).toHaveLength(0);
    expect((await p.rsvp(request('ev01', 2), 'again')).status).toBe('going');
  });

  it('takes invitation requests for a private viewing — never a place', async () => {
    const p = new MockEventsProvider(TODAY);
    const r = await p.rsvp(request('ev07', 2), 'k3');
    expect(r.status).toBe('requested');
    expect(r.guests).toBe(1);
  });

  it('needs no place for a drop-in', async () => {
    const p = new MockEventsProvider(TODAY);
    expect((await p.rsvp(request('ev05'), 'k4')).status).toBe('going');
  });

  it('refuses an RSVP for an event that has finished', async () => {
    const p = new MockEventsProvider(TODAY);
    await expect(p.rsvp(request('ev08'), 'k5')).rejects.toThrow('already taken place');
  });
});

describe('event wording', () => {
  it('states availability in words, never as a count', async () => {
    const events = await new MockEventsProvider(TODAY).listEvents();
    const labels = events.map((e) => eventStatus(e, TODAY).label);
    expect(new Set(labels)).toEqual(
      new Set(['Spaces available', 'Waitlist open', 'Drop in', 'By invitation', 'Past event']),
    );
    for (const l of labels) expect(l).not.toMatch(/\d/);
  });

  it('offers the right next step for each kind of event and reply', async () => {
    const p = new MockEventsProvider(TODAY);
    const get = async (id: string) => (await p.getEvent(id))!;
    expect(primaryLabel(await get('ev01'), undefined)).toBe('RSVP');
    expect(primaryLabel(await get('ev02'), undefined)).toBe('Join the waitlist');
    expect(primaryLabel(await get('ev03'), undefined)).toBe('Reserve a fitting');
    expect(primaryLabel(await get('ev07'), undefined)).toBe('Request an invitation');
    const going = await p.rsvp(request('ev01', 2), 'k6');
    expect(primaryLabel(await get('ev01'), going)).toBe('Add to calendar');
    expect(rsvpLabel(going).label).toBe('You’re going · +1');
  });

  it('suggests the next open fixture a piece is chosen for', async () => {
    const events = await new MockEventsProvider(TODAY).listEvents();
    expect(nextEventFor('p06', events, TODAY)?.id).toBe('ev01');
    // p09 was worn at the past styling morning; its next outing is the pop-up.
    expect(nextEventFor('p09', events, TODAY)?.id).toBe('ev05');
    // An invitation-only evening is never suggested.
    for (const p of catalogue.products)
      expect(nextEventFor(p.id, events, TODAY)?.rsvp).not.toBe('invite-only');
    expect(eventsByDay(events).size).toBeGreaterThanOrEqual(events.length);
  });
});
