import { slotsForDate, type Busy, type Window } from '../../server/slots';
import { addDays, todayInSast } from '../../shared/format';
import type { PublicBooking, Service } from '../../shared/types';
import { serviceSeed } from '../data/services';

/**
 * DEMO BUILD ONLY (`npm run build:demo`). A stand-in for the API that runs in
 * the visitor's browser, so a static preview of the site can be clicked
 * through end to end. Nothing is stored beyond the tab and nothing is sent.
 * The real API (server/) is the one production uses; this mirrors its rules
 * closely enough to show the journey, not to replace it.
 */

type Json = Record<string, unknown>;
type DemoBooking = PublicBooking & { amountDueCents: number | null };

const SAMPLE_PRICES: Record<string, [number, number | null]> = {
  consultation: [50000, null],
  'custom-design': [250000, 50000],
  fittings: [35000, null],
  'special-occasion': [400000, 100000],
};

let samplePricing = false;
const listeners = new Set<() => void>();
export const demo = {
  get samplePricing() {
    return samplePricing;
  },
  setSamplePricing(on: boolean) {
    samplePricing = on;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

function services(): Service[] {
  return serviceSeed.map((s) => {
    if (!samplePricing) return s;
    const [price, deposit] = SAMPLE_PRICES[s.id] ?? [null, null];
    return { ...s, priceCents: price, depositCents: deposit };
  });
}

// Tuesday–Friday 09:00–17:00, Saturday 09:00–13:00, as in supabase/seed.sql.
const today = todayInSast();
const availability: Window[] = [];
for (let i = 0; i < 90; i++) {
  const date = addDays(today, i);
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (wd >= 2 && wd <= 5) availability.push({ date, startTime: '09:00', endTime: '17:00' });
  if (wd === 6) availability.push({ date, startTime: '09:00', endTime: '13:00' });
}

const bookings = new Map<string, DemoBooking>();
const payments = new Map<string, { bookingId: string; amount: number }>();

const busy = (): Busy[] =>
  [...bookings.values()]
    .filter((b) => b.status === 'confirmed' || b.status === 'pending_payment')
    .map((b) => ({ date: b.date, time: b.time, durationMinutes: b.durationMinutes }));

const slots = (s: Service, date: string) =>
  date < today || date > addDays(today, 60) ? [] : slotsForDate(date, availability, busy(), { durationMinutes: s.durationMinutes, stepMinutes: 30, minNoticeMinutes: 24 * 60, now: new Date() });

class DemoError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

function handle(method: string, url: URL, body: Json): unknown {
  const parts = url.pathname.replace(/^\/api\//, '').split('/');
  const [a, b] = parts;
  const svc = (id: unknown) => services().find((s) => s.id === id) ?? null;

  if (a === 'services') return { services: services() };

  if (a === 'availability') {
    const s = svc(url.searchParams.get('serviceId'));
    if (!s) throw new DemoError(404, 'That service is not available to book.');
    const date = url.searchParams.get('date');
    if (date) return { slots: slots(s, date) };
    const month = url.searchParams.get('month') ?? '';
    return { dates: [...new Set(availability.filter((w) => w.date.startsWith(month)).map((w) => w.date))].filter((d) => slots(s, d).length) };
  }

  if (a === 'booking' && method === 'POST') {
    const s = svc(body.serviceId);
    if (!s || !slots(s, String(body.date)).includes(String(body.time))) throw new DemoError(409, 'Sorry — that time is no longer available.', { time: 'Taken' });
    const paid = s.priceCents != null;
    const id = crypto.randomUUID();
    bookings.set(id, {
      id,
      serviceId: s.id,
      serviceName: s.name,
      serviceImage: s.image,
      durationMinutes: s.durationMinutes,
      date: String(body.date),
      time: String(body.time),
      clientName: String(body.clientName),
      email: String(body.email),
      status: paid ? 'pending_payment' : 'confirmed',
      paymentStatus: paid ? 'pending' : 'not_required',
      paymentRequired: paid,
      priceCents: s.priceCents,
      depositCents: s.depositCents,
      amountPaidCents: null,
      amountDueCents: null,
      holdExpiresAt: paid ? new Date(Date.now() + 20 * 60_000).toISOString() : null,
    });
    return { bookingId: id, paymentRequired: paid };
  }

  if (a === 'booking' && b) {
    const bk = bookings.get(b);
    if (!bk) throw new DemoError(404, 'Booking not found.');
    return { booking: bk };
  }

  if (a === 'payment') {
    const bk = bookings.get(String(body.bookingId));
    if (!bk || bk.priceCents == null) throw new DemoError(404, 'Booking not found.');
    const amount = body.option === 'deposit' && bk.depositCents ? bk.depositCents : bk.priceCents;
    const reference = `DEMO-${bk.id.slice(0, 6).toUpperCase()}`;
    payments.set(reference, { bookingId: bk.id, amount });
    return {
      checkout: {
        provider: 'mock',
        action: '/payment/mock',
        method: 'GET',
        fields: {
          reference,
          amount: String(amount),
          item: `Grateful — ${bk.serviceName}`,
          return_url: `https://demo.local/confirmation?booking=${bk.id}`,
          cancel_url: `https://demo.local/payment?booking=${bk.id}&cancelled=1`,
          sig_paid: 'demo',
          sig_failed: 'demo',
        },
      },
    };
  }

  if (a === 'webhooks') {
    const p = payments.get(String(body.reference));
    const bk = p && bookings.get(p.bookingId);
    if (!p || !bk) throw new DemoError(400, 'Notification rejected.');
    if (body.outcome === 'paid') Object.assign(bk, { status: 'confirmed', paymentStatus: 'paid', amountPaidCents: p.amount });
    else bk.paymentStatus = 'failed';
    return 'OK';
  }

  if (a === 'contact' || a === 'newsletter') return { ok: true };
  throw new DemoError(404, 'Not found.');
}

/** fetch()-shaped entry point used by src/lib/api.ts in the demo build. */
export async function demoFetch(path: string, init?: RequestInit): Promise<Response> {
  await new Promise((r) => setTimeout(r, 180)); // feel like a network
  const url = new URL(path, 'https://demo.local');
  const raw = typeof init?.body === 'string' ? init.body : init?.body instanceof URLSearchParams ? init.body.toString() : '';
  let body: Json = {};
  try {
    body = raw.startsWith('{') ? (JSON.parse(raw) as Json) : Object.fromEntries(new URLSearchParams(raw));
  } catch {
    /* empty body */
  }
  try {
    const out = handle(init?.method ?? 'GET', url, body);
    return new Response(typeof out === 'string' ? out : JSON.stringify(out), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    const err = e instanceof DemoError ? e : new DemoError(500, 'Something went wrong.');
    return new Response(JSON.stringify({ error: err.message, fields: err.fields }), { status: err.status });
  }
}
