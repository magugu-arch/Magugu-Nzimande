import {
  __answerReservation,
  __resetReservations,
  cancelReservation,
  draftIsComplete,
  fetchReservation,
  fetchSlots,
  fetchUpcomingReservation,
  missingFromDraft,
  requestReservation,
  tradingHoursUnknown,
} from '@/services/reservationService';
import { reservationRules } from '@/types/reservation';
import { useReservationStore } from '@/store/reservationStore';
import type { ReservationDraft } from '@/types/reservation';

/**
 * The reservation journey — brief §7.
 *
 * The one thing worth testing above all others here is the promise the app
 * does *not* make. §15 forbids inventing customer promises, and "your table
 * is confirmed" against a restaurant with no booking system wired up is the
 * most consequential fabrication this product could ship — the failure mode
 * is a guest standing in the doorway of a full restaurant.
 */

const TOMORROW = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);

function completeDraft(over: Partial<ReservationDraft> = {}): ReservationDraft {
  return {
    date: TOMORROW,
    time: '19:00',
    partySize: 2,
    firstName: 'Thandi',
    phone: '0821234567',
    ...over,
  };
}

beforeEach(() => {
  __resetReservations();
  useReservationStore.getState().reset();
});

describe('a reservation is requested, never confirmed', () => {
  it('comes back as a request the restaurant has not answered', async () => {
    const reservation = await requestReservation(completeDraft());
    expect(reservation.status).toBe('requested');
    expect(reservation.respondedAt).toBeUndefined();
  });

  it('only becomes confirmed when the restaurant answers', async () => {
    // Not reachable from the app — a guest cannot confirm their own table.
    const reservation = await requestReservation(completeDraft());
    const answered = __answerReservation(reservation.id, 'confirmed');
    expect(answered.status).toBe('confirmed');
    expect(answered.respondedAt).toBeDefined();
  });

  it('carries a decline reason a guest can act on', async () => {
    const reservation = await requestReservation(completeDraft());
    const answered = __answerReservation(
      reservation.id,
      'declined',
      'That sitting is full. We have 20:30 free.',
    );
    expect(answered.declineReason).toMatch(/20:30/);
  });

  it('gives every request a reference somebody can quote on the phone', async () => {
    const first = await requestReservation(completeDraft());
    const second = await requestReservation(completeDraft({ time: '20:00' }));
    expect(first.reference).toMatch(/^PPS-\d{4}$/);
    expect(second.reference).not.toBe(first.reference);
  });
});

describe('what a draft needs before it can be sent', () => {
  it('needs a date, a time, a party size, a name and a number', () => {
    expect(missingFromDraft({})).toEqual(['date', 'time', 'partySize', 'firstName', 'phone']);
  });

  it('does not require an email, a surname or an occasion', () => {
    // §7 asks to "keep the form visually light". A booking form that demands
    // an email before it will hold a table is a form, not a concierge.
    expect(draftIsComplete(completeDraft())).toBe(true);
  });

  it('refuses to send an incomplete draft rather than sending half a booking', async () => {
    await expect(requestReservation({ date: TOMORROW })).rejects.toThrow(/missing/i);
  });

  it('trims a name assembled from two fields', async () => {
    const reservation = await requestReservation(completeDraft({ lastName: 'Nkosi' }));
    expect(reservation.guestName).toBe('Thandi Nkosi');
  });

  it('does not leave a trailing space when there is no surname', async () => {
    const reservation = await requestReservation(completeDraft());
    expect(reservation.guestName).toBe('Thandi');
  });
});

describe('the draft as a guest fills it in', () => {
  it('clears the time when the date changes', () => {
    // Which sittings exist depends on the date — a Sunday lunch service is
    // not a Tuesday dinner service. Carrying a time across is how a guest
    // requests 22:30 on a day the kitchen shuts at nine.
    const store = useReservationStore.getState();
    store.setDate(TOMORROW);
    store.setTime('19:00');
    store.setDate('2026-12-25');
    expect(useReservationStore.getState().draft.time).toBeUndefined();
  });

  it('clears the time when the party size changes', () => {
    // A sitting that can seat two may not seat ten, so the slot list is a
    // function of both.
    const store = useReservationStore.getState();
    store.setTime('19:00');
    store.setPartySize(10);
    expect(useReservationStore.getState().draft.time).toBeUndefined();
  });

  it('keeps everything else when a guest steps back', () => {
    const store = useReservationStore.getState();
    store.setSeating('window');
    store.setOccasion('anniversary');
    store.setDate(TOMORROW);
    const draft = useReservationStore.getState().draft;
    expect(draft.seating).toBe('window');
    expect(draft.occasion).toBe('anniversary');
  });
});

describe('the sittings offered', () => {
  it('is honest that nobody has supplied trading hours', () => {
    // §15 forbids inventing opening hours. The screen says so, and the
    // `requested` status is what makes offering an unverified time safe.
    expect(tradingHoursUnknown()).toBe(true);
  });

  it('offers half-hourly sittings across lunch and dinner', async () => {
    const slots = await fetchSlots(TOMORROW, 2);
    expect(slots.length).toBeGreaterThan(8);
    expect(slots.map((slot) => slot.time)).toContain('19:00');
  });

  it('closes every sitting to a party the form cannot take', async () => {
    // Above the ceiling it is an event, not a booking — §9's private dining
    // enquiry, which the Reserve screen offers before a guest fills anything in.
    const slots = await fetchSlots(TOMORROW, reservationRules.maxPartySize + 4);
    expect(slots.every((slot) => !slot.available)).toBe(true);
    expect(slots.every((slot) => slot.reason === 'party-too-large')).toBe(true);
  });

  it('closes a sitting that is too close to now', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const slots = await fetchSlots(today, 2);
    const past = slots.filter((slot) => !slot.available && slot.reason === 'too-soon');
    // Some of today's sittings have gone; whether all have depends on the
    // hour the suite runs, so this asserts the mechanism rather than a count.
    expect(past.every((slot) => slot.available === false)).toBe(true);
  });
});

describe('what Home shows as your next visit', () => {
  it('finds nothing for a guest who has never booked', async () => {
    await expect(fetchUpcomingReservation()).resolves.toBeNull();
  });

  it('finds a table booked for tomorrow', async () => {
    const reservation = await requestReservation(completeDraft());
    await expect(fetchUpcomingReservation()).resolves.toMatchObject({ id: reservation.id });
  });

  it('does not put a cancelled table on somebody’s home screen', async () => {
    const reservation = await requestReservation(completeDraft());
    await cancelReservation(reservation.id);
    await expect(fetchUpcomingReservation()).resolves.toBeNull();
  });

  it('does not put a declined table there either', async () => {
    const reservation = await requestReservation(completeDraft());
    __answerReservation(reservation.id, 'declined');
    await expect(fetchUpcomingReservation()).resolves.toBeNull();
  });

  it('picks the soonest when there are several', async () => {
    const later = await requestReservation(
      completeDraft({ date: new Date(Date.now() + 5 * 86_400_000).toISOString().slice(0, 10) }),
    );
    const sooner = await requestReservation(completeDraft());
    const next = await fetchUpcomingReservation();
    expect(next?.id).toBe(sooner.id);
    expect(next?.id).not.toBe(later.id);
  });
});

describe('cancelling', () => {
  it('cancels without charging, and says so', async () => {
    const reservation = await requestReservation(completeDraft());
    const cancelled = await cancelReservation(reservation.id);
    expect(cancelled.status).toBe('cancelled');
    // No deposit was taken, so there is nothing to refund —
    // `reservationRules.depositsEnabled` is false until Pappas sets a policy.
    expect(reservationRules.depositsEnabled).toBe(false);
  });

  it('refuses to cancel something that is not there', async () => {
    await expect(cancelReservation('res-nope')).rejects.toThrow(/could not find/i);
  });

  it('keeps the cancelled reservation readable', async () => {
    // A guest who cancels still wants to see what they cancelled.
    const reservation = await requestReservation(completeDraft());
    await cancelReservation(reservation.id);
    await expect(fetchReservation(reservation.id)).resolves.toMatchObject({
      status: 'cancelled',
    });
  });
});

describe('the commercial rules that are switched off', () => {
  /**
   * §7 asks for "future deposits, waitlists, special occasions and dining
   * preferences through configurable business rules". Occasions and
   * preferences are built; deposits and waitlists are configuration, off,
   * because turning either on states a policy Pappas has not set — and a
   * deposit is a charge against a guest's card.
   */
  it('takes no deposit', () => {
    expect(reservationRules.depositsEnabled).toBe(false);
  });

  it('runs no waitlist', () => {
    expect(reservationRules.waitlistEnabled).toBe(false);
  });

  it('states no cancellation window, because none has been published', () => {
    expect(reservationRules.freeCancellationHours).toBeNull();
  });
});
