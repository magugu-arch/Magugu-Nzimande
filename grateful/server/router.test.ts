import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { EmailMessage } from './email/types';
import { route, type ApiRequest } from './router';
import { unsubscribeToken } from './services/forms';
import { adminAuth, realServices, resetStudio, setupStudio, TEST_DATE as date } from './test/fixtures';

let sent: EmailMessage[];

const req = (method: string, path: string, body?: unknown, ip = '10.0.0.1'): ApiRequest => {
  const url = new URL(path, 'http://x');
  return { method, path: url.pathname, query: url.searchParams, headers: {}, ip, rawBody: body === undefined ? '' : JSON.stringify(body) };
};

const booking = { serviceId: 'consultation', date, time: '10:00', clientName: 'Thandi Mokoena', email: 'Thandi@Example.com', phone: '082 000 0000', elapsedMs: 20_000 };

beforeEach(() => {
  // The real, unpriced catalogue: what the public site shows today.
  sent = setupStudio({ services: realServices, hours: { startTime: '09:00', endTime: '13:00' } }).outbox;
});
afterEach(resetStudio);

describe('API', () => {
  it('lists services with "quote required" (null) prices, as supplied', async () => {
    const res = await route(req('GET', '/api/services'));
    const { services } = res.body as { services: { priceCents: number | null }[] };
    expect(services).toHaveLength(4);
    expect(services.every((s) => s.priceCents === null)).toBe(true);
  });

  it('returns open dates for a month and slots for a date', async () => {
    const dates = await route(req('GET', `/api/availability?serviceId=consultation&month=${date.slice(0, 7)}`));
    expect((dates.body as { dates: string[] }).dates).toContain(date);
    const slots = await route(req('GET', `/api/availability?serviceId=consultation&date=${date}`));
    expect((slots.body as { slots: string[] }).slots[0]).toBe('09:00');
  });

  it('creates a booking, normalising the email, and then hides that slot', async () => {
    const res = await route(req('POST', '/api/booking', booking));
    expect(res.status).toBe(201);
    const { bookingId } = res.body as { bookingId: string };
    const got = await route(req('GET', `/api/booking/${bookingId}`));
    expect((got.body as { booking: { email: string } }).booking.email).toBe('thandi@example.com');
    const slots = await route(req('GET', `/api/availability?serviceId=consultation&date=${date}`));
    expect((slots.body as { slots: string[] }).slots).not.toContain('10:00');
  });

  it('returns field errors for invalid input', async () => {
    const res = await route(req('POST', '/api/booking', { ...booking, email: 'nope', phone: 'call me' }));
    expect(res.status).toBe(422);
    expect(res.body).toMatchObject({ fields: { email: expect.any(String), phone: expect.any(String) } });
  });

  it('rejects honeypot and too-fast submissions', async () => {
    expect((await route(req('POST', '/api/booking', { ...booking, company: 'Acme' }))).status).toBe(422);
    expect((await route(req('POST', '/api/booking', { ...booking, elapsedMs: 200 }))).status).toBe(400);
  });

  it('rate-limits public forms per IP', async () => {
    const msg = { name: 'Lerato', email: 'l@example.com', message: 'I would love a dress for a wedding.', consent: true, elapsedMs: 9000 };
    const statuses = [];
    for (let i = 0; i < 7; i++) statuses.push((await route(req('POST', '/api/contact', msg))).status);
    expect(statuses.slice(0, 5)).toEqual([201, 201, 201, 201, 201]);
    expect(statuses.at(-1)).toBe(429);
  });

  it('sends contact enquiries to the studio with reply-to set to the sender', async () => {
    await route(req('POST', '/api/contact', { name: 'Lerato', email: 'l@example.com', subject: 'Fittings & Alterations', message: '<b>Hello</b> — could you take in a jacket?', consent: true, elapsedMs: 9000 }));
    expect(sent[0]).toMatchObject({ to: 'gratefulpty@gmail.com', replyTo: 'l@example.com' });
    expect(sent[0]!.html).toContain('&lt;b&gt;Hello&lt;/b&gt;');
  });

  it('requires consent for the newsletter and welcomes a subscriber once', async () => {
    expect((await route(req('POST', '/api/newsletter', { email: 'a@example.com', consent: false, elapsedMs: 5000 }))).status).toBe(422);
    await route(req('POST', '/api/newsletter', { email: 'a@example.com', consent: true, elapsedMs: 5000 }));
    await route(req('POST', '/api/newsletter', { email: 'a@example.com', consent: true, elapsedMs: 5000 }, '10.0.0.2'));
    expect(sent.filter((m) => m.subject === 'Welcome to Grateful')).toHaveLength(1);
  });

  it('serves a calendar file for a confirmed booking', async () => {
    const { bookingId } = (await route(req('POST', '/api/booking', booking))).body as { bookingId: string };
    const ics = await route(req('GET', `/api/booking/${bookingId}/calendar.ics`));
    expect(ics.headers?.['Content-Type']).toMatch(/text\/calendar/);
    expect(String(ics.body)).toMatch(/DTSTART:\d{8}T080000Z/); // 10:00 SAST = 08:00 UTC
  });

  it('includes a working, address-bound unsubscribe link in the welcome email', async () => {
    await route(req('POST', '/api/newsletter', { email: 'b@example.com', consent: true, elapsedMs: 5000 }));
    expect(sent[0]?.text).toContain(`token=${unsubscribeToken('b@example.com')}`);
    const forged = await route(req('POST', '/api/newsletter/unsubscribe', { email: 'b@example.com', token: unsubscribeToken('c@example.com') }));
    expect(forged.status).toBe(400);
    const ok = await route(req('POST', '/api/newsletter/unsubscribe', { email: 'b@example.com', token: unsubscribeToken('b@example.com') }));
    expect(ok.status).toBe(200);
  });

  it('lets the studio list bookings with the admin token, and no one else', async () => {
    process.env.ADMIN_TOKEN = 'studio-secret-token';
    await route(req('POST', '/api/booking', booking));
    const denied = await route({ ...req('GET', `/api/admin/bookings?from=${date}&to=${date}`), headers: { authorization: 'Bearer wrong-token-value' } });
    expect(denied.status).toBe(401);
    const ok = await route({ ...req('GET', `/api/admin/bookings?from=${date}&to=${date}`), headers: { authorization: 'Bearer studio-secret-token' } });
    expect((ok.body as { bookings: unknown[] }).bookings).toHaveLength(1);
  });

  it('runs the dashboard endpoints behind the token: session, services, hours, messages', async () => {
    const headers = adminAuth();
    const as = (r: ApiRequest) => route({ ...r, headers });
    expect((await as(req('GET', '/api/admin/session'))).status).toBe(200);
    expect((await as(req('PATCH', '/api/admin/services/fittings', { priceCents: 30_000 }))).body).toMatchObject({ service: { priceCents: 30_000 } });
    expect((await as(req('PATCH', '/api/admin/services/fittings', { priceCents: 10_000, depositCents: 50_000 }))).status).toBe(422);
    const added = await as(req('POST', '/api/admin/hours', { date, startTime: '14:00', endTime: '16:00' }));
    expect(added.status).toBe(201);
    const bad = await as(req('POST', '/api/admin/hours', { date, startTime: '16:00', endTime: '09:00' }));
    expect(bad.status).toBe(422);
    const hours = (await as(req('GET', `/api/admin/hours?from=${date}&to=${date}`))).body as { hours: { id: string }[] };
    expect(hours.hours.length).toBeGreaterThanOrEqual(2);
    expect((await as(req('DELETE', `/api/admin/hours/${hours.hours[0]!.id}`))).status).toBe(200);
    expect((await as(req('GET', '/api/admin/messages'))).status).toBe(200);
    // The same calls without the token are refused.
    expect((await route(req('PATCH', '/api/admin/services/fittings', { priceCents: 1 }))).status).toBe(401);
  });

  it('keeps admin endpoints closed without a token', async () => {
    expect((await route(req('POST', '/api/admin/bookings/00000000-0000-4000-8000-000000000000/cancel'))).status).toBe(401);
  });

  it('rejects unverifiable payment notifications without changing anything', async () => {
    const res = await route({ ...req('POST', '/api/webhooks/mock'), rawBody: 'reference=x&outcome=paid&amount=1&signature=00' });
    expect(res.status).toBe(400);
  });
});
