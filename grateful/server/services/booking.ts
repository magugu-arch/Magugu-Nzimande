import { randomBytes } from 'node:crypto';
import { addDays, sastToDate, todayInSast, formatRand } from '../../shared/format';
import type { CheckoutForm, CreateBookingResult, PaymentOption, PublicBooking, Service } from '../../shared/types';
import { config } from '../config';
import { repository } from '../db';
import type { Booking, Payment } from '../db/types';
import {
  bookingCancelledClient,
  bookingConfirmedClient,
  bookingNotificationStudio,
  paymentConflictClient,
  paymentConflictStudio,
  paymentReceiptClient,
  type BookingEmailData,
} from '../email/templates';
import { sendSafely } from '../email/providers';
import { paymentProvider } from '../payments';
import { PaymentVerificationError, type NotificationRequest } from '../payments/types';
import { sanitizeText } from '../security';
import { slotsForDate } from '../slots';

/**
 * The booking rules. Routes parse and validate input; everything that decides
 * who gets a slot, what is charged and when a booking counts as confirmed
 * happens here.
 */

export class BookingError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
  }
}

const paymentRequired = (s: Service) => s.priceCents != null && s.priceCents > 0;

function rules(service: Service, now: Date) {
  const c = config().booking;
  return { durationMinutes: service.durationMinutes, stepMinutes: c.slotStepMinutes, minNoticeMinutes: c.minNoticeHours * 60, now };
}

function bookingWindow(now: Date) {
  const from = todayInSast(now);
  return { from, to: addDays(from, config().booking.bookingWindowDays) };
}

async function activeService(serviceId: string): Promise<Service> {
  const service = await repository().getService(serviceId);
  if (!service || !service.active) throw new BookingError('That service is not available to book.', 404, 'serviceId');
  return service;
}

export async function listServices() {
  return repository().listServices();
}

export async function availableSlots(serviceId: string, date: string, now = new Date()): Promise<string[]> {
  const service = await activeService(serviceId);
  const { from, to } = bookingWindow(now);
  if (date < from || date > to) return [];
  const repo = repository();
  const [windows, busy] = await Promise.all([repo.listAvailability(date, date), repo.listBusy(date, date, now)]);
  return slotsForDate(date, windows, busy, rules(service, now));
}

/** Dates in a month (YYYY-MM) that have at least one bookable slot for the service. */
export async function availableDates(serviceId: string, month: string, now = new Date()): Promise<string[]> {
  const service = await activeService(serviceId);
  const win = bookingWindow(now);
  const monthStart = `${month}-01`;
  const monthEnd = addDays(addDays(monthStart, 31).slice(0, 8) + '01', -1);
  const from = monthStart > win.from ? monthStart : win.from;
  const to = monthEnd < win.to ? monthEnd : win.to;
  if (from > to) return [];
  const repo = repository();
  const [windows, busy] = await Promise.all([repo.listAvailability(from, to), repo.listBusy(from, to, now)]);
  const dates = [...new Set(windows.map((w) => w.date))].sort();
  return dates.filter((d) => slotsForDate(d, windows, busy, rules(service, now)).length > 0);
}

export async function createBooking(
  input: { serviceId: string; date: string; time: string; clientName: string; email: string; phone: string; notes: string },
  now = new Date(),
): Promise<{ result: CreateBookingResult; booking: Booking; service: Service }> {
  const service = await activeService(input.serviceId);

  // Re-derive the slot list: the browser's list is advice, this is the rule.
  const slots = await availableSlots(service.id, input.date, now);
  if (!slots.includes(input.time)) {
    throw new BookingError('Sorry — that time is no longer available. Please choose another.', 409, 'time');
  }

  const needsPayment = paymentRequired(service);
  const holdMinutes = config().booking.holdMinutes;
  const reserved = await repository().reserveBooking(
    {
      serviceId: service.id,
      clientName: sanitizeText(input.clientName),
      email: input.email,
      phone: sanitizeText(input.phone),
      date: input.date,
      time: input.time,
      durationMinutes: service.durationMinutes,
      notes: sanitizeText(input.notes),
      status: needsPayment ? 'pending_payment' : 'confirmed',
      paymentStatus: needsPayment ? 'pending' : 'not_required',
      holdExpiresAt: needsPayment ? new Date(now.getTime() + holdMinutes * 60_000).toISOString() : null,
    },
    now,
  );
  if (!reserved.ok) throw new BookingError('Sorry — someone has just booked that time. Please choose another.', 409, 'time');

  const booking = reserved.booking;
  if (!needsPayment) await sendConfirmation(booking, service, null);
  return { result: { bookingId: booking.id, paymentRequired: needsPayment }, booking, service };
}

export async function getPublicBooking(id: string): Promise<PublicBooking | null> {
  const repo = repository();
  const booking = await repo.getBooking(id);
  if (!booking) return null;
  const service = await repo.getService(booking.serviceId);
  const payment = booking.paymentReference ? await repo.getPaymentByReference(booking.paymentReference) : null;
  const holdLapsed = booking.status === 'pending_payment' && booking.holdExpiresAt && new Date(booking.holdExpiresAt) <= new Date();
  return {
    id: booking.id,
    serviceId: booking.serviceId,
    serviceName: service?.name ?? 'Appointment',
    serviceImage: service?.image ?? 'whiteGarment',
    durationMinutes: booking.durationMinutes,
    date: booking.date,
    time: booking.time,
    clientName: booking.clientName,
    email: booking.email,
    status: holdLapsed ? 'expired' : booking.status,
    paymentStatus: booking.paymentStatus,
    paymentRequired: booking.paymentStatus !== 'not_required',
    priceCents: service?.priceCents ?? null,
    depositCents: service?.depositCents ?? null,
    amountPaidCents: payment?.status === 'paid' ? payment.amountCents : null,
    holdExpiresAt: booking.holdExpiresAt,
  };
}

/** What a payment option costs for a service, or null if that option is not offered. */
export function amountFor(service: Service, option: PaymentOption): number | null {
  if (service.priceCents == null) return null;
  if (option === 'full') return service.priceCents;
  return service.depositCents != null && service.depositCents > 0 && service.depositCents < service.priceCents ? service.depositCents : null;
}

export async function startPayment(bookingId: string, option: PaymentOption, now = new Date()): Promise<CheckoutForm> {
  const repo = repository();
  const booking = await repo.getBooking(bookingId);
  if (!booking) throw new BookingError('Booking not found.', 404);
  if (booking.status !== 'pending_payment' || booking.paymentStatus === 'paid') {
    throw new BookingError('This booking is not awaiting payment.', 409);
  }
  if (!booking.holdExpiresAt || new Date(booking.holdExpiresAt) <= now) {
    throw new BookingError('Your time slot was held for a limited time and has been released. Please book again.', 410);
  }
  const service = await repo.getService(booking.serviceId);
  if (!service) throw new BookingError('Service not found.', 404);
  const amountCents = amountFor(service, option);
  if (amountCents == null) throw new BookingError('That payment option is not available for this service.', 400, 'option');

  const provider = paymentProvider();
  const reference = `GR-${booking.id.slice(0, 8).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`;
  await repo.createPayment({ bookingId: booking.id, amountCents, currency: 'ZAR', option, provider: provider.name, reference, providerReference: null, status: 'pending' });

  const { siteUrl } = config();
  const [firstName = booking.clientName, ...rest] = booking.clientName.split(/\s+/);
  return provider.createCheckout({
    reference,
    amountCents,
    itemName: `Grateful — ${service.name}`,
    itemDescription: `${option === 'deposit' ? 'Deposit' : 'Payment'} for ${booking.date} ${booking.time} (SAST)`,
    customer: { firstName, lastName: rest.join(' '), email: booking.email, phone: booking.phone },
    returnUrl: `${siteUrl}/confirmation?booking=${booking.id}`,
    cancelUrl: `${siteUrl}/payment?booking=${booking.id}&cancelled=1`,
    notifyUrl: `${siteUrl}/api/webhooks/${provider.name}`,
  });
}

/**
 * Handle a gateway notification. Nothing changes unless the provider verifies
 * it AND the amount matches what we asked for. Idempotent: gateways retry.
 */
export async function handlePaymentNotification(providerName: string, req: NotificationRequest, now = new Date()): Promise<void> {
  const provider = paymentProvider();
  if (provider.name !== providerName) throw new PaymentVerificationError(`Notification for ${providerName}, but ${provider.name} is configured`);

  const n = await provider.verifyNotification(req);
  const repo = repository();
  const payment = await repo.getPaymentByReference(n.reference);
  if (!payment) throw new PaymentVerificationError(`Unknown payment reference ${n.reference}`);

  if (n.outcome === 'failed' || n.outcome === 'cancelled') {
    await repo.failPayment(n.reference, n.outcome, n.providerReference || null);
    return;
  }
  if (n.outcome !== 'paid') return;

  if (Math.abs(n.amountCents - payment.amountCents) > 1) {
    throw new PaymentVerificationError(`Amount mismatch for ${n.reference}: got ${n.amountCents}, expected ${payment.amountCents}`);
  }

  const result = await repo.confirmPayment(n.reference, n.providerReference, now);
  if (!result || result.outcome === 'already_processed') return;

  const service = await repo.getService(result.booking.serviceId);
  if (!service) return;
  if (result.outcome === 'confirmed') {
    await sendConfirmation(result.booking, service, result.payment);
  } else {
    const { siteUrl, studioEmail } = config();
    const data = emailData(result.booking, service, result.payment);
    await sendSafely([paymentConflictClient(siteUrl, data), paymentConflictStudio(siteUrl, data, studioEmail, result.payment.reference)]);
  }
}

function emailData(b: Booking, s: Service, p: Payment | null): BookingEmailData {
  return {
    bookingId: b.id,
    clientName: b.clientName,
    email: b.email,
    phone: b.phone,
    serviceName: s.name,
    durationMinutes: b.durationMinutes,
    date: b.date,
    time: b.time,
    notes: b.notes,
    paymentLabel: p
      ? `${p.option === 'deposit' ? 'Deposit' : 'Paid in full'} — ${formatRand(p.amountCents)}`
      : s.priceCents == null
        ? 'Quote to follow after your consultation'
        : 'Not required',
    amountPaidCents: p?.amountCents ?? null,
  };
}

async function sendConfirmation(b: Booking, s: Service, p: Payment | null) {
  const { siteUrl, studioEmail } = config();
  const data = emailData(b, s, p);
  const messages = [bookingConfirmedClient(siteUrl, data), bookingNotificationStudio(siteUrl, data, studioEmail)];
  if (p) messages.push(paymentReceiptClient(siteUrl, data, p.reference));
  await sendSafely(messages);
}

/** An .ics file so the client can add the appointment to any calendar. */
export function calendarFile(b: PublicBooking, siteUrl: string): string {
  const start = sastToDate(b.date, b.time);
  const end = new Date(start.getTime() + b.durationMinutes * 60_000);
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (c) => `\\${c}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grateful//Bookings//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${b.id}@grateful`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escape(`Grateful — ${b.serviceName}`)}`,
    `DESCRIPTION:${escape(`Your appointment with Grateful. To reschedule, call +27 76 081 4788 or email gratefulpty@gmail.com.\n${siteUrl}/confirmation?booking=${b.id}`)}`,
    `LOCATION:${escape('Mulbarton, Johannesburg')}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}

/** Admin: cancel a booking, free its slot and tell the client. Refunds are handled in the gateway's dashboard. */
export async function cancelBooking(id: string): Promise<Booking> {
  const repo = repository();
  const booking = await repo.getBooking(id);
  if (!booking) throw new BookingError('Booking not found.', 404);
  const updated = await repo.updateBookingStatus(id, 'cancelled', booking.paymentStatus === 'pending' ? 'cancelled' : undefined);
  const service = await repo.getService(booking.serviceId);
  if (updated && service) {
    const { siteUrl } = config();
    await sendSafely([bookingCancelledClient(siteUrl, emailData(updated, service, null), 'cancelled')]);
  }
  return updated!;
}

/** Admin: list bookings between two dates (YYYY-MM-DD), for the studio's diary. */
export async function listBookingsForAdmin(from: string, to: string) {
  const repo = repository();
  const [bookings, services] = await Promise.all([repo.listBookings(from, to), repo.listServices({ includeInactive: true })]);
  const names = new Map(services.map((s) => [s.id, s.name]));
  return bookings.map((b) => ({ ...b, serviceName: names.get(b.serviceId) ?? b.serviceId }));
}

/**
 * Admin: move a confirmed booking to a new time and tell the client. The new
 * time must sit inside the opening hours and must not clash with anything
 * else; the booking's own current slot does not count against it.
 */
export async function rescheduleBooking(id: string, date: string, time: string, now = new Date()): Promise<Booking> {
  const repo = repository();
  const booking = await repo.getBooking(id);
  if (!booking) throw new BookingError('Booking not found.', 404);
  if (booking.status !== 'confirmed') throw new BookingError('Only confirmed bookings can be rescheduled.', 409);
  const service = await repo.getService(booking.serviceId);
  if (!service) throw new BookingError('Service not found.', 404);

  const windows = await repo.listAvailability(date, date);
  const open = slotsForDate(date, windows, [], { ...rules(service, now), minNoticeMinutes: 0 });
  if (!open.includes(time)) throw new BookingError('That time is outside the studio’s opening hours.', 400, 'time');

  const moved = await repo.rescheduleBooking(id, date, time, now);
  if (!moved.ok) throw new BookingError('That time is already booked.', 409, 'time');

  const { siteUrl } = config();
  await sendSafely([bookingCancelledClient(siteUrl, emailData(moved.booking, service, null), 'rescheduled')]);
  return moved.booking;
}
