import { randomUUID } from 'node:crypto';
import { serviceSeed } from '../../src/data/services';
import { addDays, sastToDate, todayInSast } from '../../shared/format';
import type { ContactMessage, OpeningHours, Service } from '../../shared/types';
import type { Busy, Window } from '../slots';
import type { Booking, ConfirmResult, NewBooking, Payment, Repository, ReserveResult } from './types';

/**
 * In-memory storage for local development and tests. State lives for the life
 * of the process, which is exactly what `npm run dev` and a test file want,
 * and exactly what production must never use — config() only picks this when
 * no Supabase credentials are present.
 *
 * Every method is synchronous under the async signature. Node runs one of
 * them at a time, so check-then-insert here is as atomic as the Postgres
 * function it stands in for.
 */

/** Sample opening hours, mirroring supabase/seed.sql. Replace with the studio's real availability. */
export function sampleAvailability(from: string, days: number): Window[] {
  const out: Window[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    if (weekday >= 2 && weekday <= 5) out.push({ date, startTime: '09:00', endTime: '17:00' });
    if (weekday === 6) out.push({ date, startTime: '09:00', endTime: '13:00' });
  }
  return out;
}

const overlaps = (a: { date: string; time: string; durationMinutes: number }, b: typeof a) => {
  if (a.date !== b.date) return false;
  const as = sastToDate(a.date, a.time).getTime();
  const bs = sastToDate(b.date, b.time).getTime();
  return as < bs + b.durationMinutes * 60_000 && bs < as + a.durationMinutes * 60_000;
};

export function createMemoryRepository(opts: { services?: Service[]; availability?: Window[]; demoPricing?: boolean } = {}): Repository {
  let services = (opts.services ?? serviceSeed).map((s) => ({ ...s }));
  if (opts.demoPricing) {
    // DEMO_PRICING=true, local development only. Not real prices.
    const sample: Record<string, [number, number | null]> = {
      consultation: [50000, null],
      'custom-design': [250000, 50000],
      fittings: [35000, null],
      'special-occasion': [400000, 100000],
    };
    services = services.map((s) => ({ ...s, priceCents: sample[s.id]?.[0] ?? null, depositCents: sample[s.id]?.[1] ?? null }));
  }
  const hours: OpeningHours[] = (opts.availability ?? sampleAvailability(todayInSast(), 90)).map((w) => ({ ...w, id: randomUUID(), status: 'open' }));
  const bookings = new Map<string, Booking>();
  const payments = new Map<string, Payment>();
  const subscribers = new Map<string, { consent: boolean; createdAt: string }>();
  const messages: ContactMessage[] = [];

  const isActive = (b: Booking, now: Date) =>
    b.status === 'confirmed' ||
    (b.status === 'pending_payment' && b.holdExpiresAt !== null && new Date(b.holdExpiresAt) > now);

  const sweep = (now: Date) => {
    for (const b of bookings.values()) {
      if (b.status === 'pending_payment' && b.holdExpiresAt && new Date(b.holdExpiresAt) <= now) b.status = 'expired';
    }
  };

  return {
    async listServices({ includeInactive = false } = {}) {
      return services.filter((s) => includeInactive || s.active).sort((a, b) => a.sortOrder - b.sortOrder);
    },
    async getService(id) {
      return services.find((s) => s.id === id) ?? null;
    },
    async updateService(id, patch) {
      const s = services.find((x) => x.id === id);
      if (!s) return null;
      Object.assign(s, patch);
      return { ...s };
    },
    async listAvailability(from, to) {
      return hours.filter((w) => w.status === 'open' && w.date >= from && w.date <= to).map(({ date, startTime, endTime }) => ({ date, startTime, endTime }));
    },
    async listOpeningHours(from, to) {
      return hours
        .filter((w) => w.date >= from && w.date <= to)
        .sort((a, b) => (a.date + a.startTime < b.date + b.startTime ? -1 : 1))
        .map((w) => ({ ...w }));
    },
    async addOpeningHours(block) {
      const row: OpeningHours = { ...block, id: randomUUID(), status: 'open' };
      hours.push(row);
      return { ...row };
    },
    async setOpeningHoursStatus(id, status) {
      const w = hours.find((x) => x.id === id);
      if (!w) return null;
      w.status = status;
      return { ...w };
    },
    async deleteOpeningHours(id) {
      const i = hours.findIndex((x) => x.id === id);
      if (i < 0) return false;
      hours.splice(i, 1);
      return true;
    },
    async listBusy(from, to, now): Promise<Busy[]> {
      return [...bookings.values()]
        .filter((b) => b.date >= from && b.date <= to && isActive(b, now))
        .map(({ date, time, durationMinutes }) => ({ date, time, durationMinutes }));
    },
    async reserveBooking(input: NewBooking, now): Promise<ReserveResult> {
      sweep(now);
      if ([...bookings.values()].some((b) => isActive(b, now) && overlaps(b, input))) return { ok: false, reason: 'slot_taken' };
      const booking: Booking = { ...input, id: randomUUID(), paymentReference: null, createdAt: now.toISOString() };
      bookings.set(booking.id, booking);
      return { ok: true, booking: { ...booking } };
    },
    async getBooking(id) {
      const b = bookings.get(id);
      return b ? { ...b } : null;
    },
    async updateBookingStatus(id, status, paymentStatus) {
      const b = bookings.get(id);
      if (!b) return null;
      b.status = status;
      if (paymentStatus) b.paymentStatus = paymentStatus;
      return { ...b };
    },
    async createPayment(p) {
      const payment: Payment = { ...p, id: randomUUID(), createdAt: new Date().toISOString() };
      payments.set(payment.reference, payment);
      const b = bookings.get(p.bookingId);
      if (b) b.paymentReference = payment.reference;
      return { ...payment };
    },
    async getPaymentByReference(reference) {
      const p = payments.get(reference);
      return p ? { ...p } : null;
    },
    async failPayment(reference, status, providerReference) {
      const p = payments.get(reference);
      if (!p) return null;
      if (p.status !== 'paid') {
        p.status = status;
        p.providerReference = providerReference ?? p.providerReference;
        const b = bookings.get(p.bookingId);
        if (b && b.paymentStatus !== 'paid') b.paymentStatus = status;
      }
      return { ...p };
    },
    async confirmPayment(reference, providerReference, now): Promise<ConfirmResult | null> {
      const p = payments.get(reference);
      if (!p) return null;
      const b = bookings.get(p.bookingId);
      if (!b) return null;
      if (p.status === 'paid') return { outcome: 'already_processed', booking: { ...b }, payment: { ...p } };

      p.status = 'paid';
      p.providerReference = providerReference;
      b.paymentStatus = 'paid';
      b.paymentReference = reference;

      // A hold that lapsed can still be honoured if nobody else took the slot.
      const clash = [...bookings.values()].some((o) => o.id !== b.id && isActive(o, now) && overlaps(o, b));
      b.status = clash ? 'needs_attention' : 'confirmed';
      return { outcome: b.status === 'confirmed' ? 'confirmed' : 'conflict', booking: { ...b }, payment: { ...p } };
    },
    async listBookings(from, to) {
      return [...bookings.values()]
        .filter((b) => b.date >= from && b.date <= to)
        .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1))
        .map((b) => ({ ...b }));
    },
    async rescheduleBooking(id, date, time, now): Promise<ReserveResult> {
      sweep(now);
      const b = bookings.get(id);
      if (!b) return { ok: false, reason: 'slot_taken' };
      const moved = { ...b, date, time };
      if ([...bookings.values()].some((o) => o.id !== id && isActive(o, now) && overlaps(o, moved))) return { ok: false, reason: 'slot_taken' };
      b.date = date;
      b.time = time;
      return { ok: true, booking: { ...b } };
    },
    async unsubscribe(email) {
      return subscribers.delete(email);
    },
    async addSubscriber(email, consent) {
      const created = !subscribers.has(email);
      subscribers.set(email, { consent, createdAt: new Date().toISOString() });
      return { created };
    },
    async addContactMessage(msg) {
      messages.push({ ...msg, id: randomUUID(), createdAt: new Date().toISOString(), status: 'new' });
    },
    async listContactMessages(limit) {
      return [...messages].reverse().slice(0, limit).map((m) => ({ ...m }));
    },
    async setContactStatus(id, status) {
      const m = messages.find((x) => x.id === id);
      if (m) m.status = status;
      return !!m;
    },
    async countSubscribers() {
      return subscribers.size;
    },
  };
}
