import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { bookingSchema, contactSchema, fieldErrors, newsletterSchema, paymentSchema } from '../shared/validation';
import { config } from './config';
import { PaymentVerificationError } from './payments/types';
import { looksLikeSpam, rateLimit } from './security';
import {
  availableDates,
  availableSlots,
  BookingError,
  calendarFile,
  cancelBooking,
  createBooking,
  getPublicBooking,
  handlePaymentNotification,
  listServices,
  startPayment,
} from './services/booking';
import { submitContact, subscribe } from './services/forms';

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

    // POST /api/newsletter
    if (method === 'POST' && a === 'newsletter') {
      const tooMany = limited(req, 'newsletter', 5, 15);
      if (tooMany) return tooMany;
      const v = validated(newsletterSchema, req);
      if (!v.ok) return v.res;
      if (!looksLikeSpam(v.data)) await subscribe(v.data.email, v.data.consent);
      return json(201, { ok: true });
    }

    // POST /api/admin/bookings/:id/cancel — Authorization: Bearer $ADMIN_TOKEN
    if (a === 'admin') {
      if (!adminAuthorised(req)) return err(401, 'Unauthorised.');
      const id = segments[2];
      if (method === 'POST' && b === 'bookings' && isUuid(id) && segments[3] === 'cancel') {
        const booking = await cancelBooking(id);
        return json(200, { booking: { id: booking.id, status: booking.status } });
      }
    }

    return err(404, 'Not found.');
  } catch (e) {
    if (e instanceof BookingError) return err(e.status, e.message, e.field ? { [e.field]: e.message } : undefined);
    console.error('[api] unhandled error on', method, path, e instanceof Error ? e.message : e);
    return err(500, 'Something went wrong on our side. Please try again, or contact us directly.');
  }
}
