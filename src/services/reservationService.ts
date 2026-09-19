import { config } from '@/constants/config';
import { venue } from '@/data/pappasContent';
import { isVerified } from '@/data/businessInput';
import type {
  Reservation,
  ReservationDraft,
  ReservationSlot,
  ReservationStatus,
} from '@/types/reservation';
import { reservationRules } from '@/types/reservation';
import { dayName } from '@/utils/datetime';
import { request } from './apiClient';

/**
 * Reservations — brief §7.
 *
 * Same arrangement as every other service here: a mock layer that makes the
 * journey fully explorable before a booking system exists, and a real path
 * that talks to an API. `config.useMockApi` decides.
 *
 * ── The one thing this service will not do ───────────────────────────────
 *
 * It will not say a table is confirmed.
 *
 * A submitted reservation comes back `requested`, and the confirmation screen
 * says the request has been sent and Pappas will confirm. That is one more
 * state than a demo needs and it is the only honest one: there is no booking
 * system behind this app, nobody has supplied trading hours, and §15 forbids
 * inventing customer promises. An app that prints "Table confirmed, see you
 * Friday" against nothing at all is the single most damaging thing this build
 * could ship — a guest arrives, and there is no table.
 *
 * When Pappas connects a booking system, `confirmReservation` is the seam:
 * the restaurant answers, the status moves, and the guest is told.
 */

/** In-memory ledger for mock mode. Empty on first open, like a real guest's. */
const ledger: Reservation[] = [];
let referenceCounter = 1;

function nextReference(): string {
  const n = referenceCounter;
  referenceCounter += 1;
  return `PPS-${String(n).padStart(4, '0')}`;
}

async function delay<T>(value: T, ms = 320): Promise<T> {
  await new Promise((resolve) => setTimeout(resolve, ms));
  return value;
}

/**
 * The sittings offered on a date.
 *
 * ── Why these times, and why they are honest ─────────────────────────────
 *
 * Nobody has supplied Pappas' trading hours — see `pappasContent.ts`, where
 * `venue.hours` is explicitly awaiting business input, and §15 forbids
 * inventing opening hours.
 *
 * So this does not invent them. Where hours *are* supplied, slots are
 * generated inside them. Where they are not, the guest is offered a spread of
 * sittings and the screen tells them plainly that times are confirmed by the
 * restaurant — which is true, because every request is confirmed by the
 * restaurant either way. A reservation *request* for 19:00 on a day Pappas
 * turns out to be closed is answered with a decline and an alternative; a
 * booking *confirmed* for that time would be a guest standing outside a dark
 * restaurant.
 *
 * That is the difference the `requested` status buys, and it is why this
 * service can offer a time it has not verified without lying.
 */
export async function fetchSlots(date: string, partySize: number): Promise<ReservationSlot[]> {
  if (!config.useMockApi) {
    return request<ReservationSlot[]>(
      `/v1/reservations/slots?date=${encodeURIComponent(date)}&party=${partySize}`,
    );
  }

  const hours = isVerified(venue.hours) ? venue.hours.value : null;
  const slots: ReservationSlot[] = [];

  // A generous spread, half-hourly, covering lunch and dinner. Replaced
  // wholesale the moment real hours arrive.
  const windows = hours
    ? hours
        .filter((day) => dayNameFor(date) === day.day)
        .map((day) => [day.opens, day.closes] as const)
    : ([
        ['12:00', '15:00'],
        ['18:00', '22:00'],
      ] as const);

  const now = Date.now();
  for (const [opens, closes] of windows) {
    for (const time of everyHalfHour(opens, closes)) {
      const at = new Date(`${date}T${time}:00`).getTime();
      const tooSoon = at - now < reservationRules.minLeadMinutes * 60_000;
      const tooLarge = partySize > reservationRules.maxPartySize;
      slots.push({
        time,
        available: !tooSoon && !tooLarge,
        ...(tooSoon ? { reason: 'too-soon' as const } : {}),
        ...(tooLarge ? { reason: 'party-too-large' as const } : {}),
      });
    }
  }

  return delay(slots, 220);
}

/** True while nobody has told us when Pappas is open. */
export function tradingHoursUnknown(): boolean {
  return !isVerified(venue.hours);
}

function dayNameFor(isoDate: string): string {
  // `dayName`, not `toLocaleDateString`: Hermes ships without full ICU on
  // some builds, and this string is matched against supplied trading hours —
  // a locale fallback here would silently match no day at all and offer a
  // guest no sittings on a day the restaurant is open.
  return dayName(new Date(`${isoDate}T12:00:00`).getDay());
}

function everyHalfHour(from: string, to: string): string[] {
  const parse = (value: string): number => {
    const [h = '0', m = '0'] = value.split(':');
    return Number(h) * 60 + Number(m);
  };
  const out: string[] = [];
  for (
    let minutes = parse(from);
    minutes <= parse(to) - reservationRules.slotMinutes;
    minutes += reservationRules.slotMinutes
  ) {
    out.push(
      `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`,
    );
  }
  return out;
}

/** What is still missing before a draft can be sent. */
export function missingFromDraft(draft: ReservationDraft): string[] {
  const missing: string[] = [];
  if (!draft.date) missing.push('date');
  if (!draft.time) missing.push('time');
  if (!draft.partySize) missing.push('partySize');
  if (!draft.firstName?.trim()) missing.push('firstName');
  if (!draft.phone?.trim()) missing.push('phone');
  return missing;
}

export function draftIsComplete(draft: ReservationDraft): boolean {
  return missingFromDraft(draft).length === 0;
}

/**
 * Send a reservation request to Pappas.
 *
 * Returns a `requested` reservation, never a confirmed one. See the header.
 */
export async function requestReservation(draft: ReservationDraft): Promise<Reservation> {
  const missing = missingFromDraft(draft);
  if (missing.length > 0) {
    throw new Error(`Reservation is missing: ${missing.join(', ')}`);
  }

  if (!config.useMockApi) {
    return request<Reservation>('/v1/reservations', { method: 'POST', body: draft });
  }

  const reservation: Reservation = {
    id: `res-${Date.now()}`,
    reference: nextReference(),
    status: 'requested',
    scheduledFor: new Date(`${draft.date}T${draft.time}:00`).toISOString(),
    partySize: draft.partySize!,
    seating: draft.seating ?? 'no-preference',
    occasion: draft.occasion ?? 'none',
    ...(draft.notes?.trim() ? { notes: draft.notes.trim() } : {}),
    guestName: [draft.firstName, draft.lastName].filter(Boolean).join(' ').trim(),
    phone: draft.phone!.trim(),
    ...(draft.email?.trim() ? { email: draft.email.trim() } : {}),
    createdAt: new Date().toISOString(),
  };

  ledger.unshift(reservation);
  return delay(reservation, 500);
}

export async function fetchReservations(): Promise<Reservation[]> {
  if (!config.useMockApi) return request<Reservation[]>('/v1/reservations');
  return delay([...ledger], 200);
}

export async function fetchReservation(id: string): Promise<Reservation> {
  if (!config.useMockApi) return request<Reservation>(`/v1/reservations/${id}`);
  const found = ledger.find((reservation) => reservation.id === id);
  if (!found) throw new Error('We could not find that reservation.');
  return delay(found, 160);
}

/**
 * The next reservation a guest has coming.
 *
 * Used by the Home screen's "Your next visit" module (§5). Only a future
 * reservation that has not been cancelled or declined counts — a guest does
 * not want yesterday's table on their home screen.
 */
export async function fetchUpcomingReservation(): Promise<Reservation | null> {
  const all = await fetchReservations();
  const now = Date.now();
  const upcoming = all
    .filter(
      (reservation) =>
        new Date(reservation.scheduledFor).getTime() > now &&
        (reservation.status === 'requested' || reservation.status === 'confirmed'),
    )
    .sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  return upcoming[0] ?? null;
}

export async function cancelReservation(id: string): Promise<Reservation> {
  if (!config.useMockApi) {
    return request<Reservation>(`/v1/reservations/${id}/cancel`, { method: 'POST' });
  }
  const index = ledger.findIndex((reservation) => reservation.id === id);
  if (index < 0) throw new Error('We could not find that reservation.');
  const updated: Reservation = {
    ...ledger[index]!,
    status: 'cancelled',
    respondedAt: new Date().toISOString(),
  };
  ledger[index] = updated;
  return delay(updated, 300);
}

/**
 * The restaurant answering a request.
 *
 * Not reachable from the app — a guest cannot confirm their own table. It
 * exists because it is the seam a real booking system plugs into, and because
 * the status machine is only testable if something can move it.
 */
export function __answerReservation(
  id: string,
  status: Extract<ReservationStatus, 'confirmed' | 'declined'>,
  declineReason?: string,
): Reservation {
  const index = ledger.findIndex((reservation) => reservation.id === id);
  if (index < 0) throw new Error('We could not find that reservation.');
  const updated: Reservation = {
    ...ledger[index]!,
    status,
    respondedAt: new Date().toISOString(),
    ...(declineReason ? { declineReason } : {}),
  };
  ledger[index] = updated;
  return updated;
}

/** Test seam: empty the mock ledger. */
export function __resetReservations(): void {
  ledger.length = 0;
  referenceCounter = 1;
}
