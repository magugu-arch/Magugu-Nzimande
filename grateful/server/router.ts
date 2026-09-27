import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { bookingSchema, contactSchema, fieldErrors, newsletterSchema, openingHoursSchema, paymentSchema, serviceUpdateSchema, studioBookingSchema } from '../shared/validation';
import { config } from './config';
import { checkLaunchConfig, launchReady } from './launch';
import { PaymentVerificationError } from './payments/types';
import { failureCount, looksLikeSpam, rateLimit } from './security';
import {
  availableDates,
  availableSlots,
  BookingError,
  calendarFile,
  cancelBooking,
  createBooking,
  getPublicBooking,
  handlePaymentNotification,
  listBookingsForAdmin,
  listServices,
  rescheduleBooking,
  sendReminders,
  startPayment,
} from './services/booking';
import { submitContact, subscribe, unsubscribe } from './services/forms';
import { addOpeningHours, createStudioBooking, overview, rescheduleOptions, studioSlots, updateService } from './services/admin';
import { repository } from './db';

/**
 * Every API endpoint, as plain functions from request to response so the same
 * code runs under Vite in development, on Vercel, and in tests.
 */

export type ApiRequest = {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string | undefined>;
  ip: string;
  rawBody: string;
};

export type ApiResponse = {
  status: number;
  headers?: Record<string, string>;
  body: unknown;
};

const json = (status: number, body: unknown): ApiResponse => ({ status, body });
const err = (status: number, error: string, fields?: Record<string, string>): ApiResponse => json(status, fields ? { error, fields } : { error });

function parseJson(raw: string): unknown {
  try {
    return raw ? JSON.parse(raw) : {};
  } catch {
    return undefined;
  }
}

function validated<T extends z.ZodType>(schema: T, req: ApiRequest): { ok: true; data: z.output<T> } | { ok: false; res: ApiResponse } {
  const body = parseJson(req.rawBody);
  if (body === undefined) return { ok: false, res: err(400, 'Invalid JSON.') };
  const parsed = schema.safeParse(body);
  if (!parsed.success) return { ok: false, res: err(422, 'Please check the highlighted fields.', fieldErrors(parsed.error)) };
  return { ok: true, data: parsed.data };
}

const limited = (req: ApiRequest, bucket: string, limit: number, minutes: number) =>
  !rateLimit(bucket, req.ip, limit, minutes * 60_000) ? err(429, 'Too many requests. Please wait a few minutes and try again.') : null;

const isDate = (s: string | null): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s: string | null): s is string => !!s && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const isUuid = (s: string | undefined): s is string => !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

const ADMIN_FAIL_LIMIT = 10;
const adminLockedOut = (ip: string) => failureCount('admin-fail', ip) >= ADMIN_FAIL_LIMIT;

function adminAuthorised(req: ApiRequest): boolean {
  const token = config().adminToken;
  if (!token) return false;
  const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function route(req: ApiRequest): Promise<ApiResponse> {
  const { method, path } = req;
  const segments = path.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const [a, b, c] = segments;

  try {
    // GET /api/health — for uptime monitors and the person deploying. Pass/fail per
    // check only; never a value. 200 when ready to take real bookings, else 503.
    if (method === 'GET' && a === 'health') {
      const checks = checkLaunchConfig(process.env);
      const ready = launchReady(checks);
      return {
        status: ready ? 200 : 503,
        headers: { 'Cache-Control': 'no-store' },
        body: { ready, checks: checks.map(({ id, ok, level }) => ({ id, ok, level })) },
      };
    }

    // GET /api/services
    if (method === 'GET' && a === 'services' && !b) {
      return { status: 200, headers: { 'Cache-Control': 'public, max-age=60' }, body: { services: await listServices() } };
    }

    // GET /api/availability?serviceId=&date=     → { slots }
    // GET /api/availability?serviceId=&month=    → { dates }
    if (method === 'GET' && a === 'availability') {
      const serviceId = req.query.get('serviceId');
      if (!serviceId) return err(400, 'serviceId is required.');
      const date = req.query.get('date');
      const month = req.query.get('month');
      if (isDate(date)) return json(200, { slots: await availableSlots(serviceId, date) });
      if (isMonth(month)) return json(200, { dates: await availableDates(serviceId, month) });
      return err(400, 'Provide date=YYYY-MM-DD or month=YYYY-MM.');
    }

    // POST /api/booking
    if (method === 'POST' && a === 'booking' && !b) {
      const tooMany = limited(req, 'booking', 10, 15);
      if (tooMany) return tooMany;
      const v = validated(bookingSchema, req);
      if (!v.ok) return v.res;
      if (looksLikeSpam(v.data)) return err(400, 'Your booking could not be submitted. Please try again.');
      const { result } = await createBooking(v.data);
      return json(201, result);
    }

    // GET /api/booking/:id   GET /api/booking/:id/calendar.ics
    if (method === 'GET' && a === 'booking' && b) {
      if (!isUuid(b)) return err(404, 'Booking not found.');
      const booking = await getPublicBooking(b);
      if (!booking) return err(404, 'Booking not found.');
      if (c === 'calendar.ics') {
        if (booking.status !== 'confirmed') return err(409, 'Only confirmed bookings can be added to a calendar.');
        return {
          status: 200,
          headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'attachment; filename="grateful-appointment.ics"' },
          body: calendarFile(booking, config().siteUrl),
        };
      }
      return { status: 200, headers: { 'Cache-Control': 'no-store' }, body: { booking } };
    }

    // POST /api/payment → checkout form for the configured gateway
    if (method === 'POST' && a === 'payment' && !b) {
      const tooMany = limited(req, 'payment', 20, 15);
      if (tooMany) return tooMany;
      const v = validated(paymentSchema, req);
      if (!v.ok) return v.res;
      return json(200, { checkout: await startPayment(v.data.bookingId, v.data.option) });
    }

    // POST /api/webhooks/:provider — gateway notifications (form-encoded)
    if (method === 'POST' && a === 'webhooks' && b) {
      try {
        await handlePaymentNotification(b, { rawBody: req.rawBody, ip: req.ip });
      } catch (e) {
        if (e instanceof PaymentVerificationError) {
          // Log the reason, never the payload (it can carry customer details).
          console.error('[payments] rejected notification:', e.message);
          return err(400, 'Notification rejected.');
        }
        throw e;
      }
      // PayFast expects a bare 200.
      return { status: 200, headers: { 'Content-Type': 'text/plain' }, body: 'OK' };
    }

    // POST /api/contact
    if (method === 'POST' && a === 'contact') {
      const tooMany = limited(req, 'contact', 5, 15);
      if (tooMany) return tooMany;
      const v = validated(contactSchema, req);
      if (!v.ok) return v.res;
      // Pretend success to bots so they do not retry with a better disguise.
      if (!looksLikeSpam(v.data)) await submitContact({ ...v.data, phone: v.data.phone ?? '' });
      return json(201, { ok: true });
    }

    // POST /api/newsletter/unsubscribe { email, token } — the link in every newsletter email
    if (method === 'POST' && a === 'newsletter' && b === 'unsubscribe') {
      const tooMany = limited(req, 'unsubscribe', 10, 15);
      if (tooMany) return tooMany;
      const v = validated(z.object({ email: z.string().trim().toLowerCase().pipe(z.email()), token: z.string().min(10).max(100) }), req);
      if (!v.ok) return v.res;
      return (await unsubscribe(v.data.email, v.data.token)) ? json(200, { ok: true }) : err(400, 'This unsubscribe link is not valid.');
    }

    // POST /api/newsletter
    if (method === 'POST' && a === 'newsletter' && !b) {
      const tooMany = limited(req, 'newsletter', 5, 15);
      if (tooMany) return tooMany;
      const v = validated(newsletterSchema, req);
      if (!v.ok) return v.res;
      if (!looksLikeSpam(v.data)) await subscribe(v.data.email, v.data.consent);
      return json(201, { ok: true });
    }

    // GET /api/cron/reminders — daily, from the host's scheduler (vercel.json "crons").
    // Authorization: Bearer $CRON_SECRET. Disabled until CRON_SECRET is set.
    if (a === 'cron' && b === 'reminders' && (method === 'GET' || method === 'POST')) {
      const secret = config().cronSecret;
      const given = Buffer.from((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
      if (!secret || given.length !== Buffer.byteLength(secret) || !timingSafeEqual(given, Buffer.from(secret))) return err(401, 'Unauthorised.');
      return { status: 200, headers: { 'Cache-Control': 'no-store' }, body: await sendReminders() };
    }

    // POST /api/admin/bookings/:id/cancel — Authorization: Bearer $ADMIN_TOKEN
    if (a === 'admin') {
      // Guessing the studio key: after 10 wrong tries from one address in 15
      // minutes, refuse everything from it (right key included) until the
      // window passes. Correct requests do not count against the limit.
      if (adminLockedOut(req.ip)) return err(429, 'Too many wrong studio keys. Please wait 15 minutes and try again.');
      if (!adminAuthorised(req)) {
        rateLimit('admin-fail', req.ip, ADMIN_FAIL_LIMIT, 15 * 60_000);
        return err(401, 'Unauthorised.');
      }
      const id = segments[2];
      // GET /api/admin/bookings?from=YYYY-MM-DD&to=YYYY-MM-DD
      if (method === 'GET' && b === 'bookings' && !id) {
        const from = req.query.get('from');
        const to = req.query.get('to');
        if (!isDate(from) || !isDate(to)) return err(400, 'Provide from and to as YYYY-MM-DD.');
        return { status: 200, headers: { 'Cache-Control': 'no-store' }, body: { bookings: await listBookingsForAdmin(from, to) } };
      }
      const noStore = (body: unknown): ApiResponse => ({ status: 200, headers: { 'Cache-Control': 'no-store' }, body });

      // GET /api/admin/session — lets the dashboard check a token before showing anything
      if (method === 'GET' && b === 'session') return noStore({ ok: true });
      // GET /api/admin/overview — the numbers across the top of the dashboard
      if (method === 'GET' && b === 'overview') return noStore(await overview());

      // Services: GET list (incl. hidden), PATCH one
      if (method === 'GET' && b === 'services' && !id) return noStore({ services: await repository().listServices({ includeInactive: true }) });
      if (method === 'PATCH' && b === 'services' && id) {
        const v = validated(serviceUpdateSchema, req);
        if (!v.ok) return v.res;
        const service = await updateService(id, v.data);
        return json(200, { service });
      }

      // Opening hours: GET range, POST one day or a weekly pattern, PATCH open/closed, DELETE
      if (method === 'GET' && b === 'hours') {
        const from = req.query.get('from');
        const to = req.query.get('to');
        if (!isDate(from) || !isDate(to)) return err(400, 'Provide from and to as YYYY-MM-DD.');
        return noStore({ hours: await repository().listOpeningHours(from, to) });
      }
      if (method === 'POST' && b === 'hours' && !id) {
        const v = validated(openingHoursSchema, req);
        if (!v.ok) return v.res;
        return json(201, await addOpeningHours(v.data));
      }
      if (method === 'PATCH' && b === 'hours' && isUuid(id)) {
        const v = validated(z.object({ status: z.enum(['open', 'closed']) }), req);
        if (!v.ok) return v.res;
        const hours = await repository().setOpeningHoursStatus(id, v.data.status);
        return hours ? json(200, { hours }) : err(404, 'Not found.');
      }
      if (method === 'DELETE' && b === 'hours' && isUuid(id)) {
        return (await repository().deleteOpeningHours(id)) ? json(200, { ok: true }) : err(404, 'Not found.');
      }

      // Enquiries: GET newest first, PATCH status
      if (method === 'GET' && b === 'messages') return noStore({ messages: await repository().listContactMessages(100) });
      if (method === 'PATCH' && b === 'messages' && isUuid(id)) {
        const v = validated(z.object({ status: z.enum(['new', 'replied', 'archived']) }), req);
        if (!v.ok) return v.res;
        return (await repository().setContactStatus(id, v.data.status)) ? json(200, { ok: true }) : err(404, 'Not found.');
      }

      // GET /api/admin/slots?serviceId=&date= — free times for a booking the studio is entering
      if (method === 'GET' && b === 'slots') {
        const serviceId = req.query.get('serviceId');
        const date = req.query.get('date');
        if (!serviceId || !isDate(date)) return err(400, 'Provide serviceId and date.');
        return noStore({ slots: await studioSlots(serviceId, date) });
      }
      // POST /api/admin/bookings — a booking taken by phone, WhatsApp or in person
      if (method === 'POST' && b === 'bookings' && !id) {
        const v = validated(studioBookingSchema, req);
        if (!v.ok) return v.res;
        const booking = await createStudioBooking(v.data);
        return json(201, { booking: { id: booking.id, date: booking.date, time: booking.time } });
      }

      // GET /api/admin/bookings/:id/options?date= — times a booking could move to
      if (method === 'GET' && b === 'bookings' && isUuid(id) && segments[3] === 'options') {
        const date = req.query.get('date');
        if (!isDate(date)) return err(400, 'Provide date as YYYY-MM-DD.');
        return noStore({ slots: await rescheduleOptions(id, date) });
      }

      if (method === 'POST' && b === 'bookings' && isUuid(id) && segments[3] === 'cancel') {
        const booking = await cancelBooking(id);
        return json(200, { booking: { id: booking.id, status: booking.status } });
      }
      // POST /api/admin/bookings/:id/reschedule { date, time }
      if (method === 'POST' && b === 'bookings' && isUuid(id) && segments[3] === 'reschedule') {
        const v = validated(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }), req);
        if (!v.ok) return v.res;
        const booking = await rescheduleBooking(id, v.data.date, v.data.time);
        return json(200, { booking: { id: booking.id, date: booking.date, time: booking.time } });
      }
    }

    return err(404, 'Not found.');
  } catch (e) {
    if (e instanceof BookingError) return err(e.status, e.message, e.field ? { [e.field]: e.message } : undefined);
    console.error('[api] unhandled error on', method, path, e instanceof Error ? e.message : e);
    return err(500, 'Something went wrong on our side. Please try again, or contact us directly.');
  }
}
