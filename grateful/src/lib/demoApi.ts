import { slotsForDate, type Busy, type Window } from '../../server/slots';
import { addDays, todayInSast } from '../../shared/format';
import type { AdminBooking, ContactMessage, OpeningHours, PublicBooking, Service, ServiceUpdate } from '../../shared/types';
import { serviceSeed } from '../data/services';

/**
 * DEMO BUILD ONLY (`npm run build:demo`). A stand-in for the API that runs in
 * the visitor's browser, so a static preview of the site can be clicked
 * through end to end. Nothing is stored beyond the tab and nothing is sent.
 * The real API (server/) is the one production uses; this mirrors its rules
 * closely enough to show the journey, not to replace it.
 */

type Json = Record<string, unknown>;
type DemoBooking = PublicBooking & { amountDueCents: number | null; phone: string; notes: string; createdAt: string };

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

// Changes made in the preview's studio dashboard, layered over the seed.
const edits = new Map<string, ServiceUpdate>();

function services(includeInactive = false): Service[] {
  return serviceSeed
    .map((s) => {
      const base = samplePricing ? { ...s, priceCents: SAMPLE_PRICES[s.id]?.[0] ?? null, depositCents: SAMPLE_PRICES[s.id]?.[1] ?? null } : s;
      return { ...base, ...edits.get(s.id) };
    })
    .filter((s) => includeInactive || s.active);
}

// Tuesday–Friday 09:00–17:00, Saturday 09:00–13:00, as in supabase/seed.sql.
const today = todayInSast();
const hours: OpeningHours[] = [];
for (let i = 0; i < 90; i++) {
  const date = addDays(today, i);
  const wd = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (wd >= 2 && wd <= 5) hours.push({ id: crypto.randomUUID(), date, startTime: '09:00', endTime: '17:00', status: 'open' });
  if (wd === 6) hours.push({ id: crypto.randomUUID(), date, startTime: '09:00', endTime: '13:00', status: 'open' });
}
const openWindows = (): Window[] => hours.filter((h) => h.status === 'open').map(({ date, startTime, endTime }) => ({ date, startTime, endTime }));

const bookings = new Map<string, DemoBooking>();
const messages: ContactMessage[] = [];
const payments = new Map<string, { bookingId: string; amount: number }>();

const busy = (): Busy[] =>
  [...bookings.values()]
    .filter((b) => b.status === 'confirmed' || b.status === 'pending_payment')
    .map((b) => ({ date: b.date, time: b.time, durationMinutes: b.durationMinutes }));

const slots = (s: Service, date: string) =>
  date < today || date > addDays(today, 60) ? [] : slotsForDate(date, openWindows(), busy(), { durationMinutes: s.durationMinutes, stepMinutes: 30, minNoticeMinutes: 24 * 60, now: new Date() });

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
    return { dates: [...new Set(openWindows().filter((w) => w.date.startsWith(month)).map((w) => w.date))].filter((d) => slots(s, d).length) };
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
      phone: String(body.phone ?? ''),
      notes: String(body.notes ?? ''),
      createdAt: new Date().toISOString(),
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

  if (a === 'contact') {
    messages.unshift({ id: crypto.randomUUID(), name: String(body.name), email: String(body.email), phone: String(body.phone ?? ''), subject: String(body.subject ?? ''), message: String(body.message), status: 'new', createdAt: new Date().toISOString() });
    return { ok: true };
  }
  if (a === 'newsletter') return { ok: true };
  if (a === 'admin') return handleAdmin(method, parts.slice(1), url, body);
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

// --- Studio dashboard (preview) --------------------------------------------

const toAdmin = (b: DemoBooking): AdminBooking => ({
  id: b.id,
  serviceId: b.serviceId,
  serviceName: b.serviceName,
  clientName: b.clientName,
  email: b.email,
  phone: b.phone,
  date: b.date,
  time: b.time,
  durationMinutes: b.durationMinutes,
  notes: b.notes,
  status: b.status,
  paymentStatus: b.paymentStatus,
  paymentReference: null,
  createdAt: b.createdAt,
});

function handleAdmin(method: string, parts: string[], url: URL, body: Json): unknown {
  const [section, id, action] = parts;
  const q = (k: string) => url.searchParams.get(k) ?? '';

  if (section === 'session') return { ok: true };
  if (section === 'overview') {
    const live = [...bookings.values()];
    return {
      today,
      todayCount: live.filter((b) => b.date === today && b.status === 'confirmed').length,
      weekCount: live.filter((b) => b.date >= today && b.date <= addDays(today, 6) && b.status === 'confirmed').length,
      needsAttention: live.filter((b) => b.status === 'needs_attention').length,
      awaitingPayment: live.filter((b) => b.status === 'pending_payment').length,
      newMessages: messages.filter((m) => m.status === 'new').length,
      subscribers: 0,
    };
  }
  if (section === 'slots') {
    const svc = services(true).find((x) => x.id === q('serviceId'));
    if (!svc) throw new DemoError(404, 'Service not found.');
    return { slots: slotsForDate(q('date'), openWindows(), busy(), { durationMinutes: svc.durationMinutes, stepMinutes: 30, minNoticeMinutes: 0, now: new Date() }) };
  }
  if (section === 'bookings' && !id && method === 'POST') {
    const svc = services(true).find((x) => x.id === body.serviceId);
    if (!svc) throw new DemoError(404, 'Service not found.');
    const free = slotsForDate(String(body.date), openWindows(), busy(), { durationMinutes: svc.durationMinutes, stepMinutes: 30, minNoticeMinutes: 0, now: new Date() });
    if (!free.includes(String(body.time))) throw new DemoError(409, 'That time is taken or outside opening hours.', { time: 'Taken' });
    const bid = crypto.randomUUID();
    bookings.set(bid, {
      id: bid, serviceId: svc.id, serviceName: svc.name, serviceImage: svc.image, durationMinutes: svc.durationMinutes,
      date: String(body.date), time: String(body.time), clientName: String(body.clientName), email: String(body.email ?? ''),
      phone: String(body.phone ?? ''), notes: String(body.notes ?? ''), status: 'confirmed', paymentStatus: 'not_required',
      paymentRequired: false, priceCents: null, depositCents: null, amountPaidCents: null, amountDueCents: null, holdExpiresAt: null,
      createdAt: new Date().toISOString(),
    });
    return { booking: { id: bid, date: body.date, time: body.time } };
  }
  if (section === 'bookings' && !id) {
    return { bookings: [...bookings.values()].filter((b) => b.date >= q('from') && b.date <= q('to')).sort((x, y) => (x.date + x.time < y.date + y.time ? -1 : 1)).map(toAdmin) };
  }
  if (section === 'bookings' && id) {
    const b = bookings.get(id);
    if (!b) throw new DemoError(404, 'Booking not found.');
    if (action === 'options') {
      const others = busy().filter((x) => !(x.date === b.date && x.time === b.time));
      return { slots: slotsForDate(q('date'), openWindows(), others, { durationMinutes: b.durationMinutes, stepMinutes: 30, minNoticeMinutes: 0, now: new Date() }) };
    }
    if (action === 'reschedule') {
      Object.assign(b, { date: String(body.date), time: String(body.time) });
      return { booking: { id: b.id, date: b.date, time: b.time } };
    }
    if (action === 'cancel') {
      b.status = 'cancelled';
      return { booking: { id: b.id, status: b.status } };
    }
  }
  if (section === 'services' && !id) return { services: services(true) };
  if (section === 'services' && id && method === 'PATCH') {
    const u = body as ServiceUpdate;
    const current = services(true).find((s) => s.id === id);
    const price = u.priceCents !== undefined ? u.priceCents : current?.priceCents;
    const deposit = u.depositCents !== undefined ? u.depositCents : current?.depositCents;
    if (deposit != null && (price == null || deposit > price)) throw new DemoError(400, 'The deposit must be less than the price.', { depositCents: 'Must be less than the price.' });
    edits.set(id, { ...edits.get(id), ...u });
    return { service: services(true).find((s) => s.id === id) };
  }
  if (section === 'hours' && !id && method === 'GET') return { hours: hours.filter((h) => h.date >= q('from') && h.date <= q('to')).sort((x, y) => (x.date + x.startTime < y.date + y.startTime ? -1 : 1)) };
  if (section === 'hours' && !id && method === 'POST') {
    const dates: string[] = [];
    if (body.date) dates.push(String(body.date));
    else for (let d = String(body.from); d <= String(body.to); d = addDays(d, 1)) if ((body.weekdays as number[]).includes(new Date(`${d}T12:00:00Z`).getUTCDay())) dates.push(d);
    const added: OpeningHours[] = [];
    const skipped: string[] = [];
    for (const date of dates) {
      if (hours.some((h) => h.date === date && h.status === 'open' && h.startTime < String(body.endTime) && String(body.startTime) < h.endTime)) skipped.push(date);
      else {
        const row: OpeningHours = { id: crypto.randomUUID(), date, startTime: String(body.startTime), endTime: String(body.endTime), status: 'open' };
        hours.push(row);
        added.push(row);
      }
    }
    return { added, skipped };
  }
  if (section === 'hours' && id) {
    const i = hours.findIndex((h) => h.id === id);
    if (i < 0) throw new DemoError(404, 'Not found.');
    if (method === 'DELETE') hours.splice(i, 1);
    else hours[i]!.status = body.status === 'closed' ? 'closed' : 'open';
    return { ok: true };
  }
  if (section === 'messages' && !id) return { messages };
  if (section === 'messages' && id) {
    const m = messages.find((x) => x.id === id);
    if (m) m.status = body.status as ContactMessage['status'];
    return { ok: true };
  }
  throw new DemoError(404, 'Not found.');
}

/**
 * Preview fixtures: a few fictional clients so the dashboard has something
 * to show. They exist only in this browser tab.
 */
function seedPreview() {
  const sample: [number, string, string, string, string, DemoBooking['status']][] = [
    [1, '10:00', 'consultation', 'Lerato Dlamini (sample)', 'Matric dance dress — thinking emerald, off-the-shoulder.', 'confirmed'],
    [1, '14:00', 'fittings', 'Aisha Patel (sample)', 'Taking in a blazer at the waist.', 'confirmed'],
    [2, '09:30', 'custom-design', 'Nomsa Khumalo (sample)', '', 'confirmed'],
    [3, '11:00', 'special-occasion', 'Zanele Mokoena (sample)', 'Wedding in March. Bringing fabric swatches.', 'confirmed'],
  ];
  for (const [offset, time, serviceId, name, notes, status] of sample) {
    let date = addDays(today, offset);
    // Land on the next open day so the sample reads like a real diary.
    while (!openWindows().some((w) => w.date === date)) date = addDays(date, 1);
    const s = serviceSeed.find((x) => x.id === serviceId)!;
    const id = crypto.randomUUID();
    bookings.set(id, {
      id,
      serviceId,
      serviceName: s.name,
      serviceImage: s.image,
      durationMinutes: s.durationMinutes,
      date,
      time,
      clientName: name,
      email: `${name.split(' ')[0]!.toLowerCase()}@example.com`,
      phone: '082 000 0000',
      notes,
      status,
      paymentStatus: 'not_required',
      paymentRequired: false,
      priceCents: null,
      depositCents: null,
      amountPaidCents: null,
      amountDueCents: null,
      holdExpiresAt: null,
      createdAt: new Date().toISOString(),
    });
  }
  messages.push({
    id: crypto.randomUUID(),
    name: 'Thandi Nkosi (sample)',
    email: 'thandi@example.com',
    phone: '',
    subject: 'Custom Fashion Design',
    message: 'Hi! I would love a two-piece for my sister’s traditional wedding in April. Do you work with shweshwe?',
    status: 'new',
    createdAt: new Date().toISOString(),
  });
}
seedPreview();
