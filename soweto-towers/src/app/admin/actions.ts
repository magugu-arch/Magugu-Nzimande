'use server';

import { eq } from 'drizzle-orm';
import type { Route } from 'next';
import { refresh, updateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { activities, type ActivityId } from '@/content/catalog';
import { allImages } from '@/content/images';
import { verifyPassword } from '@/lib/auth/password';
import { createSession, destroySession, requireStaff } from '@/lib/auth/session';
import { matchTotp, verifyTotp } from '@/lib/auth/totp';
import * as admin from '@/lib/data/admin';
import { checkIn } from '@/lib/data/bookings';
import { getSetting, setSetting } from '@/lib/data/settings';
import type { CapacityConfig, PriceOverrides } from '@/lib/data/settings-types';
import { getDb, schema } from '@/lib/db';
import { notifyClipReady, notifyTowerStatus } from '@/lib/notify';
import { sendPushToTopic, sendWhatsAppTemplate } from '@/lib/notify/channels';
import type { HoursOverride } from '@/lib/hours';
import { rateLimit } from '@/lib/security';
import type { TowerState, TowerStatus } from '@/lib/status-types';
import { formatDayLong, ymdInSast } from '@/lib/time';

export type ActionState = { ok: boolean; message: string; detail?: string } | null;

const ok = (message: string, detail?: string): ActionState => ({ ok: true, message, detail });
const fail = (message: string): ActionState => ({ ok: false, message });
const text = (form: FormData, key: string) => String(form.get(key) ?? '').trim();

// ---------- Sign in / out ----------

export type LoginState = { error?: string; needCode?: boolean } | null;

let dummyHash: Promise<string> | null = null;
async function burnTime(password: string) {
  // Same work whether or not the email exists, so response time leaks nothing.
  const { hashPassword } = await import('@/lib/auth/password');
  dummyHash ??= hashPassword('not-a-real-password-for-timing-only');
  await verifyPassword(password, await dummyHash);
}

function safeNext(value: string): string {
  return value.startsWith('/admin') && !value.startsWith('//') && !value.includes('..') ? value : '/admin';
}

export async function login(_: LoginState, form: FormData): Promise<LoginState> {
  if (!(await rateLimit('login', 8, 600))) return { error: 'Too many attempts from this connection. Wait ten minutes and try again.' };
  const email = text(form, 'email').toLowerCase();
  const password = String(form.get('password') ?? '');
  const code = text(form, 'code');
  if (!email || !password) return { error: 'Enter your email and password.' };
  const db = await getDb();
  const [staff] = await db.select().from(schema.staff).where(eq(schema.staff.email, email));
  if (!staff) {
    await burnTime(password);
    return { error: 'That email and password don’t match.' };
  }
  if (!(await verifyPassword(password, staff.passwordHash))) return { error: 'That email and password don’t match.' };
  if (staff.totpSecret) {
    if (!code) return { error: 'Enter the 6-digit code from your authenticator app.', needCode: true };
    const step = matchTotp(staff.totpSecret, code);
    if (step === null) {
      return { error: 'That code didn’t work. Codes change every 30 seconds: try the current one.', needCode: true };
    }
    if (!(await admin.claimTotpStep(staff.id, step))) {
      return { error: 'That code has already been used. Wait for the next one.', needCode: true };
    }
  }
  await db.update(schema.staff).set({ lastLoginAt: new Date() }).where(eq(schema.staff.id, staff.id));
  await createSession({ id: staff.id, name: staff.name, email: staff.email, role: staff.role, version: staff.sessionVersion });
  await admin.audit({ id: staff.id, name: staff.name }, 'sign_in', {});
  redirect(safeNext(text(form, 'next')) as Route);
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect('/admin/login');
}

// ---------- Tower status ----------

const towerStates = ['auto', 'open', 'hold', 'closed'] as const;

export async function updateTowerStatus(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const state = text(form, 'state') as TowerState;
  if (!towerStates.includes(state)) return fail('Choose a status.');
  const note = text(form, 'note').slice(0, 200) || null;
  const queueRaw = text(form, 'queueMinutes');
  const queue = queueRaw === '' ? null : Math.round(Number(queueRaw));
  if (queue !== null && (!Number.isFinite(queue) || queue < 0 || queue > 300)) return fail('Queue time must be between 0 and 300 minutes.');
  const previous = await getSetting('tower_status');
  const next: TowerStatus = { state, note, queueMinutes: queue, updatedAt: new Date().toISOString() };
  await setSetting('tower_status', next);
  await admin.audit(staff, 'tower_status', { from: previous.state, to: state, note, queue });

  const wasStopped = previous.state === 'hold' || previous.state === 'closed';
  const notifyAs: 'hold' | 'closed' | 'open' | null =
    state === 'hold' || state === 'closed' ? (state === previous.state ? null : state) : wasStopped && (state === 'open' || state === 'auto') ? 'open' : null;
  let detail: string | undefined;
  if (notifyAs && form.get('notify') === 'on') {
    const todays = await admin.todaysPaidBookings(ymdInSast(new Date()));
    await notifyTowerStatus(notifyAs, note, todays);
    detail = `Told ${todays.length} ${todays.length === 1 ? 'booking' : 'bookings'} for today and push subscribers.`;
  }
  refresh();
  const label = { auto: 'Following the schedule', open: 'Open', hold: 'Weather hold', closed: 'Closed' }[state];
  return ok(`Status set: ${label}.`, detail);
}

// ---------- Walk-ins ----------

export async function logWalkInAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const activityId = text(form, 'activityId') as ActivityId;
  const qty = Math.round(Number(text(form, 'qty')));
  if (!activities.some((a) => a.id === activityId && a.booking.mode !== 'enquiry')) return fail('Choose an activity.');
  if (!(qty >= 1 && qty <= 60)) return fail('Enter how many people (1 to 60).');
  const { name, unit } = await admin.logWalkIn({ activityId, qty, staffName: staff.name });
  await admin.audit(staff, 'walk_in', { activityId, qty });
  updateTag('stats');
  refresh();
  return ok(`Logged ${qty} × ${name} at R${unit} each.`);
}

export async function removeWalkInAction(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = Number(text(form, 'id'));
  if (!Number.isInteger(id)) return;
  await admin.removeWalkIn(id);
  await admin.audit(staff, 'walk_in_removed', { id });
  updateTag('stats');
  refresh();
}

// ---------- Check-in ----------

export type ScanResult = {
  tone: 'go' | 'warn' | 'stop';
  title: string;
  detail: string;
  ref?: string;
  name?: string;
  summary?: string;
  people?: number;
  visitDate?: string | null;
};

export async function scanTicket(value: string): Promise<ScanResult> {
  const staff = await requireStaff();
  const input = String(value ?? '')
    .trim()
    .slice(0, 500);
  if (!input) return { tone: 'stop', title: 'Nothing scanned', detail: 'Scan a ticket QR code or type a booking reference.' };
  const result = await checkIn(input, staff.name);
  if (!result.ok) return { tone: 'stop', title: 'Not valid', detail: result.message };
  const b = result.booking.booking;
  const base = {
    ref: b.ref,
    name: b.name,
    summary: String((b.meta as { summary?: string }).summary ?? ''),
    people: result.booking.people.length || result.booking.items.find((i) => i.kind === 'activity' || i.kind === 'event')?.qty || 1,
    visitDate: b.visitDate,
  };
  if (!result.already) await admin.audit(staff, 'check_in', { ref: b.ref });
  refresh();
  if (result.wrongDay) {
    return {
      tone: 'warn',
      title: 'Different day',
      detail: `Booked for ${b.visitDate ? formatDayLong(b.visitDate) : 'another day'}. ${result.already ? result.message : 'Checked in anyway: undo if they should come back.'}`,
      ...base,
    };
  }
  if (result.already) return { tone: 'warn', title: 'Already in', detail: result.message, ...base };
  return { tone: 'go', title: 'Checked in', detail: 'Paid and valid for today.', ...base };
}

export async function checkInAction(_: ScanResult | null, form: FormData): Promise<ScanResult> {
  return scanTicket(text(form, 'value'));
}

export async function undoCheckInAction(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const ref = text(form, 'ref');
  if (!ref) return;
  await admin.undoCheckIn(ref);
  await admin.audit(staff, 'check_in_undone', { ref });
  refresh();
}

// ---------- Booking detail ----------

export async function resendConfirmationAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const ref = text(form, 'ref');
  const sent = await admin.resendConfirmation(ref);
  if (!sent) return fail('Only paid bookings can be re-sent.');
  await admin.audit(staff, 'confirmation_resent', { ref });
  refresh();
  return ok('Confirmation sent again. It shows in the Outbox.');
}

export async function cancelBookingAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const ref = text(form, 'ref');
  if (text(form, 'confirm') !== 'on') return fail('Tick the box to confirm the cancellation.');
  const res = await admin.cancelBooking(ref);
  if (!res.ok) return fail(res.message);
  await admin.audit(staff, 'booking_cancelled', { ref, previous: res.previous, reason: text(form, 'reason').slice(0, 300) });
  updateTag('stats');
  refresh();
  return ok(res.message);
}

const clipSchema = z.object({
  ref: z.string().min(3),
  kind: z.enum(['scream', 'full']),
  url: z.url({ protocol: /^https$/, error: 'Paste a link that starts with https://' }),
  participant: z.string().trim().max(60).optional(),
});

export async function attachClipAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = clipSchema.safeParse({
    ref: text(form, 'ref'),
    kind: text(form, 'kind'),
    url: text(form, 'url'),
    participant: text(form, 'participant') || undefined,
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the link.');
  const c = parsed.data;
  const { bookingByRef } = await import('@/lib/data/bookings');
  const d = await bookingByRef(c.ref);
  if (!d) return fail('Booking not found.');
  await admin.attachClip({ ref: d.booking.ref, kind: c.kind, url: c.url, participant: c.participant ?? null });
  await admin.audit(staff, 'clip_attached', { ref: d.booking.ref, kind: c.kind });
  if (c.kind === 'scream') {
    await notifyClipReady({ ref: d.booking.ref, name: d.booking.name, phone: d.booking.phone, email: d.booking.email });
  }
  refresh();
  return ok(c.kind === 'scream' ? 'Clip saved and the jumper has been told.' : 'Full edit saved. It shows on Find my jump.');
}

export async function removeClipAction(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = Number(text(form, 'id'));
  if (!Number.isInteger(id)) return;
  await admin.removeClip(id);
  await admin.audit(staff, 'clip_removed', { id, ref: text(form, 'ref') });
  refresh();
}

// ---------- Inbox ----------

export async function replyToChat(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const id = text(form, 'conversationId');
  const body = text(form, 'body').slice(0, 2000);
  if (!body) return fail('Write a reply first.');
  const done = await admin.staffReply(id, staff.name.split(' ')[0] ?? staff.name, body);
  if (!done) return fail('That conversation no longer exists.');
  refresh();
  return ok('Sent.');
}

export async function markChatRead(id: string): Promise<void> {
  await requireStaff();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  await admin.markConversationRead(id);
}

export async function setChatStatusAction(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = text(form, 'conversationId');
  const status = text(form, 'status') === 'closed' ? 'closed' : 'open';
  await admin.setConversationStatus(id, status);
  await admin.audit(staff, `chat_${status}`, { id });
  refresh();
}

export async function setEnquiryStatusAction(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const id = text(form, 'id');
  const status = text(form, 'status');
  if (status !== 'new' && status !== 'replied' && status !== 'closed') return;
  await admin.setEnquiryStatus(id, status);
  await admin.audit(staff, 'enquiry_status', { id, status });
  refresh();
}

export async function setTableStatusAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const id = text(form, 'id');
  const status = text(form, 'status');
  if (status !== 'confirmed' && status !== 'declined' && status !== 'requested') return fail('Unknown status.');
  const t = await admin.tableRequest(id);
  if (!t) return fail('That request no longer exists.');
  await admin.setTableStatus(id, status);
  await admin.audit(staff, 'table_status', { id, status });
  if (status === 'confirmed') {
    const first = t.name.split(' ')[0] ?? t.name;
    const day = formatDayLong(t.date);
    await sendWhatsAppTemplate({
      to: t.phone,
      template: 'table_confirmed',
      params: [first, day, t.time, String(t.partySize)],
      preview: `Hi ${first}, your table at Chaf-Pozi is confirmed for ${day} at ${t.time}, ${t.partySize} ${t.partySize === 1 ? 'person' : 'people'}. See you at the towers.`,
      bookingRef: t.bookingRef,
    });
  }
  refresh();
  return ok(status === 'confirmed' ? `Confirmed. ${t.name} has been sent a WhatsApp.` : status === 'declined' ? 'Marked as declined.' : 'Reopened.');
}

// ---------- Events ----------

const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const sastLocal = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Choose a date and time');

const eventSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(3, 'Give the event a title').max(120),
  slug: z.string().trim().max(80).optional(),
  tag: z.string().trim().min(2, 'Add a short tag, e.g. “Launch”').max(30),
  summary: z.string().trim().min(10, 'Write a one-line summary').max(220),
  body: z.string().trim().min(10, 'Describe the event').max(4000),
  startsAt: sastLocal,
  endsAt: sastLocal,
  image: z.string().refine((v) => allImages.some((i) => i.slug === v), 'Choose an image'),
  price: z
    .string()
    .trim()
    .regex(/^\d{0,5}$/, 'Price in whole rand, or leave empty for a free RSVP'),
  capacity: z.coerce.number().int().min(1, 'Capacity must be at least 1').max(20000),
  status: z.enum(['draft', 'published', 'cancelled']),
});

export async function saveEventAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = eventSchema.safeParse({
    id: text(form, 'id') || undefined,
    title: text(form, 'title'),
    slug: text(form, 'slug') || undefined,
    tag: text(form, 'tag'),
    summary: text(form, 'summary'),
    body: String(form.get('body') ?? '').trim(),
    startsAt: text(form, 'startsAt'),
    endsAt: text(form, 'endsAt'),
    image: text(form, 'image'),
    price: text(form, 'price'),
    capacity: text(form, 'capacity'),
    status: text(form, 'status'),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const e = parsed.data;
  const startsAt = new Date(`${e.startsAt}:00+02:00`);
  const endsAt = new Date(`${e.endsAt}:00+02:00`);
  if (!(endsAt > startsAt)) return fail('The end must be after the start.');
  const slug = slugify(e.slug || e.title);
  if (!slug) return fail('The web address (slug) needs letters or numbers.');
  const res = await admin.saveEvent({
    id: e.id,
    slug,
    title: e.title,
    tag: e.tag,
    summary: e.summary,
    body: e.body,
    startsAt,
    endsAt,
    image: e.image,
    price: e.price === '' ? null : Number(e.price),
    capacity: e.capacity,
    status: e.status,
  });
  if (!res.ok) return fail(res.message);
  await admin.audit(staff, e.id ? 'event_updated' : 'event_created', { id: res.id, slug, status: e.status });
  updateTag('events');
  updateTag(`event:${slug}`);
  if (!e.id) redirect(`/admin/events/${res.id}?saved=1` as Route);
  refresh();
  return ok('Saved. The public events pages are updated.');
}

// ---------- Vouchers ----------

const voucherSchema = z.object({
  label: z.string().trim().min(3, 'Describe what the voucher is for').max(80),
  value: z.coerce.number().int().min(1, 'Value in whole rand').max(20000),
  recipientName: z.string().trim().min(2, 'Who is it for?').max(80),
  recipientEmail: z.union([z.email('Check the email'), z.literal('')]),
  recipientPhone: z.union([z.string().regex(/^\+?[\d\s()-]{9,20}$/, 'Check the number'), z.literal('')]),
  message: z.string().trim().max(280),
});

export async function issueVoucherAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const parsed = voucherSchema.safeParse({
    label: text(form, 'label'),
    value: text(form, 'value'),
    recipientName: text(form, 'recipientName'),
    recipientEmail: text(form, 'recipientEmail'),
    recipientPhone: text(form, 'recipientPhone'),
    message: text(form, 'message'),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const v = parsed.data;
  const { code, token } = await admin.issueCompVoucher({
    label: v.label,
    value: v.value,
    recipientName: v.recipientName,
    recipientEmail: v.recipientEmail || null,
    recipientPhone: v.recipientPhone || null,
    message: v.message || null,
    staff,
  });
  await admin.audit(staff, 'voucher_issued', { code, value: v.value, label: v.label });
  refresh();
  return ok(`Voucher ${code} issued.`, `/voucher/${code}?t=${token}`);
}

export async function voidVoucherAction(form: FormData): Promise<void> {
  const staff = await requireStaff();
  const code = text(form, 'code');
  if (await admin.voidVoucher(code)) await admin.audit(staff, 'voucher_void', { code });
  refresh();
}

// ---------- Settings (admins) ----------

const resources = ['bridge', 'scad', 'zipline', 'lift', 'arena'] as const;

export async function saveCapacityAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('admin');
  const num = (k: string) => Number(text(form, k));
  const cfg: CapacityConfig = {
    slotMinutes: num('slotMinutes'),
    onlineShare: num('onlineSharePct') / 100,
    perSlot: Object.fromEntries(resources.map((r) => [r, Math.round(num(`perSlot_${r}`))])) as CapacityConfig['perSlot'],
    horizonDays: Math.round(num('horizonDays')),
    cutoffMinutes: Math.round(num('cutoffMinutes')),
    holdMinutes: Math.round(num('holdMinutes')),
  };
  if (![15, 20, 30, 60].includes(cfg.slotMinutes)) return fail('Slot length must be 15, 20, 30 or 60 minutes.');
  if (!(cfg.onlineShare >= 0.1 && cfg.onlineShare <= 1)) return fail('Online share must be between 10% and 100%.');
  if (resources.some((r) => !(cfg.perSlot[r] >= 0 && cfg.perSlot[r] <= 200))) return fail('Places per slot must be between 0 and 200.');
  if (!(cfg.horizonDays >= 7 && cfg.horizonDays <= 400)) return fail('Booking window must be 7 to 400 days.');
  if (!(cfg.cutoffMinutes >= 0 && cfg.cutoffMinutes <= 600)) return fail('Same-day cut-off must be 0 to 600 minutes.');
  if (!(cfg.holdMinutes >= 5 && cfg.holdMinutes <= 120)) return fail('Payment hold must be 5 to 120 minutes.');
  await setSetting('capacity', cfg);
  await admin.audit(staff, 'capacity_saved', cfg as unknown as Record<string, unknown>);
  refresh();
  return ok('Capacity saved. New bookings use it straight away.');
}

export async function savePricesAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('admin');
  const overrides: PriceOverrides = {};
  for (const a of activities) {
    const price = Math.round(Number(text(form, `price_${a.id}`)));
    const group = a.group ? Math.round(Number(text(form, `group_${a.id}`))) : undefined;
    const disabled = form.get(`off_${a.id}`) === 'on';
    if (!(price >= 1 && price <= 20000)) return fail(`${a.name}: enter a price in whole rand.`);
    if (a.group && !(group! >= 1 && group! <= price)) return fail(`${a.name}: the group price must be between R1 and the normal price.`);
    const o: PriceOverrides[ActivityId] = {};
    if (price !== a.price) o.price = price;
    if (a.group && group !== a.group.price) o.groupPrice = group;
    if (disabled) o.disabled = true;
    if (Object.keys(o).length) overrides[a.id] = o;
  }
  await setSetting('price_overrides', overrides);
  await admin.audit(staff, 'prices_saved', overrides as Record<string, unknown>);
  updateTag('catalog');
  refresh();
  return ok('Prices saved. The website and booking flow show them now.');
}

export async function addHoursOverrideAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('admin');
  const date = text(form, 'date');
  const closed = form.get('closed') === 'on';
  const opensAt = text(form, 'opensAt');
  const note = text(form, 'note').slice(0, 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail('Choose a date.');
  if (date < ymdInSast(new Date())) return fail('That date has passed.');
  if (!closed && !/^([01]\d|2[0-3]):[0-5]\d$/.test(opensAt)) return fail('Tick “Closed all day” or set a special opening time.');
  const list = (await getSetting('hours_overrides')).filter((o) => o.date !== date);
  const entry: HoursOverride = closed ? { date, closed: true, note: note || undefined } : { date, opensAt, note: note || undefined };
  list.push(entry);
  list.sort((a, b) => a.date.localeCompare(b.date));
  await setSetting('hours_overrides', list);
  await admin.audit(staff, 'hours_override', entry as unknown as Record<string, unknown>);
  refresh();
  return ok(closed ? `Closed on ${formatDayLong(date)}.` : `Opens at ${opensAt} on ${formatDayLong(date)}.`);
}

export async function removeHoursOverrideAction(form: FormData): Promise<void> {
  const staff = await requireStaff('admin');
  const date = text(form, 'date');
  const list = (await getSetting('hours_overrides')).filter((o) => o.date !== date);
  await setSetting('hours_overrides', list);
  await admin.audit(staff, 'hours_override_removed', { date });
  refresh();
}

// ---------- Broadcast ----------

export async function broadcastAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const title = text(form, 'title').slice(0, 60);
  const body = text(form, 'body').slice(0, 180);
  const url = text(form, 'url') || '/visit';
  if (title.length < 3 || body.length < 5) return fail('Add a title and a short message.');
  if (!url.startsWith('/')) return fail('The link must be a page on this site, starting with /.');
  const delivered = await sendPushToTopic('status', { title, body, url, tag: 'broadcast' }, 'broadcast');
  await admin.audit(staff, 'broadcast', { title, delivered });
  refresh();
  return ok(delivered === 1 ? 'Sent to 1 device.' : `Sent to ${delivered} devices.`, 'Every send is listed in the log below.');
}

// ---------- Team (admins) ----------

const staffSchema = z.object({
  name: z.string().trim().min(2, 'Enter their name').max(80),
  email: z.email('Enter a valid email').max(120),
  role: z.enum(['crew', 'admin']),
  password: z.string().min(10, 'Temporary password: at least 10 characters').max(200),
});

export async function addStaffAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff('admin');
  const parsed = staffSchema.safeParse({
    name: text(form, 'name'),
    email: text(form, 'email'),
    role: text(form, 'role'),
    password: String(form.get('password') ?? ''),
  });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? 'Check the form.');
  const res = await admin.addStaff(parsed.data);
  if (!res.ok) return fail(res.message);
  await admin.audit(staff, 'staff_added', { email: parsed.data.email, role: parsed.data.role });
  refresh();
  return ok(`${parsed.data.name} can now sign in. Ask them to set up two-step sign-in on the Team page.`);
}

export async function removeStaffAction(form: FormData): Promise<void> {
  const staff = await requireStaff('admin');
  const id = text(form, 'id');
  if (!id || id === staff.id) return;
  const row = await admin.staffRow(id);
  if (!row) return;
  if (row.role === 'admin' && (await admin.adminCount()) <= 1) return;
  await admin.removeStaff(id);
  await admin.audit(staff, 'staff_removed', { email: row.email });
  refresh();
}

export async function enableTotpAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const secret = text(form, 'secret');
  const code = text(form, 'code');
  if (!/^[A-Z2-7]{16,64}$/.test(secret)) return fail('Start the set-up again.');
  if (!verifyTotp(secret, code)) return fail('That code didn’t match. Check the app shows “Soweto Towers” and try the current code.');
  await admin.setTotpSecret(staff.id, secret);
  await admin.audit(staff, 'totp_enabled', {});
  refresh();
  return ok('Two-step sign-in is on. You’ll need a code each time you sign in.');
}

export async function disableTotpAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  const row = await admin.staffRow(staff.id);
  if (!row?.totpSecret) return fail('Two-step sign-in is already off.');
  if (!verifyTotp(row.totpSecret, text(form, 'code'))) return fail('Enter a current code from your authenticator app to turn it off.');
  await admin.setTotpSecret(staff.id, null);
  await admin.audit(staff, 'totp_disabled', {});
  refresh();
  return ok('Two-step sign-in is off.');
}

export async function changePasswordAction(_: ActionState, form: FormData): Promise<ActionState> {
  const staff = await requireStaff();
  if (!(await rateLimit(`password:${staff.id}`, 5, 600))) return fail('Too many attempts. Wait ten minutes and try again.');
  const current = String(form.get('current') ?? '');
  const next = String(form.get('password') ?? '');
  const repeat = String(form.get('repeat') ?? '');
  const row = await admin.staffRow(staff.id);
  if (!row || !(await verifyPassword(current, row.passwordHash))) return fail('Your current password isn’t right.');
  if (next.length < 10) return fail('Choose a new password of at least 10 characters.');
  if (next.length > 200) return fail('That password is too long.');
  if (next !== repeat) return fail('The two new passwords don’t match.');
  if (next === current) return fail('Choose a password you haven’t used here before.');
  const version = await admin.setPassword(staff.id, next);
  // Every other device is now signed out; keep this one signed in.
  await createSession({ ...staff, version });
  await admin.audit(staff, 'password_changed', {});
  return ok('Password changed. Any other devices have been signed out.');
}

/** One-tap check-in from a list (Today's schedule, booking detail). */
export async function quickCheckInAction(form: FormData): Promise<void> {
  await scanTicket(text(form, 'ref'));
}
