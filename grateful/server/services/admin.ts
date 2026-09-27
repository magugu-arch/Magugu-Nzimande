import { addDays, todayInSast } from '../../shared/format';
import type { OpeningHours, ServiceUpdate } from '../../shared/types';
import { repository } from '../db';
import { slotsForDate } from '../slots';
import { BookingError, listBookingsForAdmin, sendConfirmation } from './booking';
import { sanitizeText } from '../security';
import { config } from '../config';

/**
 * What the studio dashboard (/studio) reads and changes. Every function here
 * sits behind the admin token check in router.ts.
 */

const MAX_HOURS_BLOCKS = 200;

export async function overview(now = new Date()) {
  const repo = repository();
  const today = todayInSast(now);
  const [upcoming, messages, subscribers] = await Promise.all([
    listBookingsForAdmin(today, addDays(today, 30)),
    repo.listContactMessages(50),
    repo.countSubscribers(),
  ]);
  const live = upcoming.filter((b) => b.status === 'confirmed' || b.status === 'pending_payment' || b.status === 'needs_attention');
  return {
    today,
    todayCount: live.filter((b) => b.date === today && b.status === 'confirmed').length,
    weekCount: live.filter((b) => b.date <= addDays(today, 6) && b.status === 'confirmed').length,
    needsAttention: upcoming.filter((b) => b.status === 'needs_attention').length,
    awaitingPayment: live.filter((b) => b.status === 'pending_payment').length,
    newMessages: messages.filter((m) => m.status === 'new').length,
    subscribers,
  };
}

export async function updateService(id: string, patch: ServiceUpdate) {
  const repo = repository();
  const current = await repo.getService(id);
  if (!current) throw new BookingError('Service not found.', 404);
  // Check the pair as it will be after the change, not just the fields sent.
  const price = patch.priceCents !== undefined ? patch.priceCents : current.priceCents;
  const deposit = patch.depositCents !== undefined ? patch.depositCents : current.depositCents;
  if (deposit != null && price == null) throw new BookingError('A deposit needs a price.', 400, 'depositCents');
  if (deposit != null && price != null && deposit > price) throw new BookingError('The deposit cannot be more than the price.', 400, 'depositCents');
  return repo.updateService(id, patch);
}

/** Expand a single date, or a range + weekdays, into the dates to open. */
function datesFor(input: { date?: string | undefined; from?: string | undefined; to?: string | undefined; weekdays?: number[] | undefined }) {
  if (input.date) return [input.date];
  const out: string[] = [];
  for (let d = input.from!; d <= input.to! && out.length <= MAX_HOURS_BLOCKS; d = addDays(d, 1)) {
    if (input.weekdays!.includes(new Date(`${d}T12:00:00Z`).getUTCDay())) out.push(d);
  }
  return out;
}

/**
 * Open the studio for bookings on one or more days. Days that already have
 * an overlapping open block are skipped rather than doubled, and reported.
 */
export async function addOpeningHours(input: { date?: string; from?: string; to?: string; weekdays?: number[]; startTime: string; endTime: string }) {
  const dates = datesFor(input);
  if (dates.length > MAX_HOURS_BLOCKS) throw new BookingError(`Add at most ${MAX_HOURS_BLOCKS} days at a time.`, 400, 'to');
  if (dates.length === 0) throw new BookingError('None of those days fall in the chosen range.', 400, 'weekdays');
  if (dates[0]! < todayInSast()) throw new BookingError('Opening hours cannot start in the past.', 400, 'date');

  const repo = repository();
  const existing = await repo.listOpeningHours(dates[0]!, dates[dates.length - 1]!);
  const added: OpeningHours[] = [];
  const skipped: string[] = [];
  for (const date of dates) {
    const clash = existing.some((w) => w.date === date && w.status === 'open' && w.startTime < input.endTime && input.startTime < w.endTime);
    if (clash) skipped.push(date);
    else added.push(await repo.addOpeningHours({ date, startTime: input.startTime, endTime: input.endTime }));
  }
  return { added, skipped };
}

/** Open times a confirmed booking could move to: opening hours minus other bookings, no notice period. */
export async function rescheduleOptions(bookingId: string, date: string, now = new Date()) {
  const repo = repository();
  const booking = await repo.getBooking(bookingId);
  if (!booking) throw new BookingError('Booking not found.', 404);
  const [windows, busy] = await Promise.all([repo.listAvailability(date, date), repo.listBusy(date, date, now)]);
  // Its own current slot does not count against it.
  const others = busy.filter((b) => !(booking.date === date && b.time === booking.time && b.durationMinutes === booking.durationMinutes));
  return slotsForDate(date, windows, others, { durationMinutes: booking.durationMinutes, stepMinutes: config().booking.slotStepMinutes, minNoticeMinutes: 0, now });
}

/** Free start times for a service on a date, for the studio's own bookings: opening hours minus bookings, no notice period. */
export async function studioSlots(serviceId: string, date: string, now = new Date()) {
  const repo = repository();
  const service = await repo.getService(serviceId);
  if (!service) throw new BookingError('Service not found.', 404);
  const [windows, busy] = await Promise.all([repo.listAvailability(date, date), repo.listBusy(date, date, now)]);
  return slotsForDate(date, windows, busy, { durationMinutes: service.durationMinutes, stepMinutes: config().booking.slotStepMinutes, minNoticeMinutes: 0, now });
}

/**
 * Record a booking taken by phone, WhatsApp or in person. It is confirmed at
 * once; any payment is settled with the studio directly, so none is asked
 * for online. The same overlap guard as online bookings applies.
 */
export async function createStudioBooking(
  input: { serviceId: string; date: string; time: string; clientName: string; phone: string; email: string; notes: string; notifyClient: boolean },
  now = new Date(),
) {
  const repo = repository();
  const service = await repo.getService(input.serviceId);
  if (!service) throw new BookingError('Service not found.', 404, 'serviceId');
  if (!(await studioSlots(service.id, input.date, now)).includes(input.time)) {
    throw new BookingError('That time is taken or outside opening hours.', 409, 'time');
  }
  const reserved = await repo.reserveBooking(
    {
      serviceId: service.id,
      clientName: sanitizeText(input.clientName),
      email: input.email,
      phone: sanitizeText(input.phone),
      date: input.date,
      time: input.time,
      durationMinutes: service.durationMinutes,
      notes: sanitizeText(input.notes),
      status: 'confirmed',
      paymentStatus: 'not_required',
      holdExpiresAt: null,
    },
    now,
  );
  if (!reserved.ok) throw new BookingError('Someone has just booked that time.', 409, 'time');
  await sendConfirmation(reserved.booking, service, null, { client: input.notifyClient });
  return reserved.booking;
}
