import 'server-only';
import { and, asc, count, desc, eq, gt, gte, ilike, inArray, isNotNull, isNull, lt, ne, or, sql, sum } from 'drizzle-orm';
import { activities, getPackage, type ActivityId } from '@/content/catalog';
import { hashPassword } from '@/lib/auth/password';
import type { StaffSession } from '@/lib/auth/session';
import { liveActivities } from '@/lib/booking/engine';
import { getDb, schema } from '@/lib/db';
import type { EnquiryType, EventStatus } from '@/lib/db/schema';
import { normaliseCode, secretToken, voucherCode } from '@/lib/ids';
import { notifyBookingConfirmed } from '@/lib/notify';
import { ymdInSast } from '@/lib/time';
import { bookingByRef } from './bookings';
import { getSetting } from './settings';

/**
 * Queries and writes used only by the crew console. Every caller is a Server
 * Component or Server Action that has already checked the staff session.
 */

const s = schema;

// ---------- Audit ----------

export async function audit(staff: Pick<StaffSession, 'id' | 'name'> | null, action: string, detail: Record<string, unknown> = {}) {
  const db = await getDb();
  await db.insert(s.auditLog).values({ staffId: staff?.id ?? null, staffName: staff?.name ?? null, action, detail });
}

export async function recentAudit(limit = 20) {
  const db = await getDb();
  return db.select().from(s.auditLog).orderBy(desc(s.auditLog.id)).limit(limit);
}

// ---------- Counts for the nav and Today ----------

export async function inboxCounts() {
  const db = await getDb();
  const today = ymdInSast(new Date());
  const [chats, enq, tables] = await Promise.all([
    db
      .select({ n: count() })
      .from(s.conversations)
      .where(and(eq(s.conversations.status, 'open'), gt(s.conversations.unreadForStaff, 0))),
    db.select({ n: count() }).from(s.enquiries).where(eq(s.enquiries.status, 'new')),
    db
      .select({ n: count() })
      .from(s.tableRequests)
      .where(and(eq(s.tableRequests.status, 'requested'), gte(s.tableRequests.date, today))),
  ]);
  const chatsN = Number(chats[0]?.n ?? 0);
  const enqN = Number(enq[0]?.n ?? 0);
  const tablesN = Number(tables[0]?.n ?? 0);
  return { chats: chatsN, enquiries: enqN, tables: tablesN, total: chatsN + enqN + tablesN };
}

export async function todayStats(date: string) {
  const db = await getDb();
  const month = date.slice(0, 7);
  const [online, gate, paid, checked, monthOnline, monthGate] = await Promise.all([
    db
      .select({ n: sql<number>`coalesce(sum(${s.bookingItems.qty}), 0)` })
      .from(s.bookingItems)
      .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
      .where(and(eq(s.bookingItems.kind, 'activity'), eq(s.bookingItems.slotDate, date), eq(s.bookings.status, 'paid'))),
    db
      .select({ n: sql<number>`coalesce(sum(${s.walkIns.qty}), 0)` })
      .from(s.walkIns)
      .where(eq(s.walkIns.date, date)),
    db
      .select({ n: count() })
      .from(s.bookings)
      .where(and(eq(s.bookings.visitDate, date), eq(s.bookings.status, 'paid'), ne(s.bookings.kind, 'voucher'))),
    db
      .select({ n: count() })
      .from(s.bookings)
      .where(and(eq(s.bookings.visitDate, date), eq(s.bookings.status, 'paid'), isNotNull(s.bookings.checkedInAt))),
    db
      .select({ n: sql<number>`coalesce(sum(${s.bookingItems.qty}), 0)` })
      .from(s.bookingItems)
      .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
      .where(and(eq(s.bookingItems.kind, 'activity'), eq(s.bookings.status, 'paid'), sql`to_char(${s.bookingItems.slotDate}, 'YYYY-MM') = ${month}`)),
    db
      .select({ n: sql<number>`coalesce(sum(${s.walkIns.qty}), 0)` })
      .from(s.walkIns)
      .where(sql`to_char(${s.walkIns.date}, 'YYYY-MM') = ${month}`),
  ]);
  const n = (rows: { n: number }[]) => Number(rows[0]?.n ?? 0);
  return {
    onlineToday: n(online),
    gateToday: n(gate),
    bookingsToday: n(paid),
    checkedInToday: n(checked),
    monthOnline: n(monthOnline),
    monthGate: n(monthGate),
  };
}

/** Today's paid visitors, for weather-hold and closure messages. */
export async function todaysPaidBookings(date: string) {
  const db = await getDb();
  return db
    .select({
      ref: s.bookings.ref,
      name: s.bookings.name,
      phone: s.bookings.phone,
      notifyWhatsapp: s.bookings.notifyWhatsapp,
      ticketToken: s.bookings.ticketToken,
    })
    .from(s.bookings)
    .where(and(eq(s.bookings.visitDate, date), eq(s.bookings.status, 'paid'), ne(s.bookings.kind, 'voucher')));
}

// ---------- Gate sales ----------

export async function logWalkIn(input: { activityId: ActivityId; qty: number; staffName: string }) {
  const overrides = await getSetting('price_overrides');
  const a = liveActivities(overrides).find((x) => x.id === input.activityId);
  if (!a) throw new Error('Unknown activity');
  const unit = a.group && input.qty >= a.group.min ? a.group.price : a.price;
  const db = await getDb();
  const [row] = await db
    .insert(s.walkIns)
    .values({
      date: ymdInSast(new Date()),
      activityId: a.id,
      qty: input.qty,
      amount: unit * input.qty,
      staffName: input.staffName,
    })
    .returning();
  return { row: row!, unit, name: a.name };
}

export async function walkInsFor(date: string) {
  const db = await getDb();
  return db.select().from(s.walkIns).where(eq(s.walkIns.date, date)).orderBy(desc(s.walkIns.id));
}

export async function removeWalkIn(id: number) {
  const db = await getDb();
  await db.delete(s.walkIns).where(eq(s.walkIns.id, id));
}

// ---------- Bookings ----------

export async function undoCheckIn(ref: string) {
  const db = await getDb();
  await db
    .update(s.bookings)
    .set({ checkedInAt: null, checkedInBy: null, updatedAt: new Date() })
    .where(eq(s.bookings.ref, normaliseCode(ref)));
}

export async function cancelBooking(ref: string): Promise<{ ok: boolean; message: string; previous?: string }> {
  const db = await getDb();
  const [b] = await db
    .select()
    .from(s.bookings)
    .where(eq(s.bookings.ref, normaliseCode(ref)));
  if (!b) return { ok: false, message: 'Booking not found.' };
  if (!['paid', 'pending_payment', 'held'].includes(b.status)) {
    return { ok: false, message: `This booking is already ${b.status.replace('_', ' ')}.` };
  }
  await db.update(s.bookings).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(s.bookings.id, b.id));
  if (b.voucherCode && b.voucherApplied > 0) {
    await db
      .update(s.vouchers)
      .set({ balance: sql`${s.vouchers.balance} + ${b.voucherApplied}`, status: 'active' })
      .where(eq(s.vouchers.code, b.voucherCode));
  }
  return {
    ok: true,
    previous: b.status,
    message:
      b.status === 'paid'
        ? 'Cancelled. The places are released. Refund the payment in the PayFast dashboard if one is due.'
        : 'Cancelled. The places are released.',
  };
}

export async function resendConfirmation(ref: string): Promise<boolean> {
  const d = await bookingByRef(ref);
  if (!d || d.booking.status !== 'paid') return false;
  const { booking: b, items } = d;
  const firstTime =
    items
      .filter((i) => i.slotTime)
      .map((i) => i.slotTime!)
      .sort()[0] ?? null;
  await notifyBookingConfirmed({
    id: b.id,
    ref: b.ref,
    kind: b.kind,
    name: b.name,
    email: b.email,
    phone: b.phone,
    notifyWhatsapp: b.notifyWhatsapp,
    visitDate: b.visitDate,
    total: b.total,
    ticketToken: b.ticketToken,
    summary: String((b.meta as { summary?: string }).summary ?? 'Your booking'),
    firstTime,
  });
  return true;
}

export async function attachClip(input: { ref: string; kind: 'scream' | 'full'; url: string; participant: string | null }) {
  const db = await getDb();
  await db.insert(s.clips).values({
    bookingRef: normaliseCode(input.ref),
    kind: input.kind,
    url: input.url,
    participant: input.participant,
  });
}

export async function removeClip(id: number) {
  const db = await getDb();
  await db.delete(s.clips).where(eq(s.clips.id, id));
}

export async function bookingAudit(ref: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.auditLog)
    .where(sql`${s.auditLog.detail}->>'ref' = ${normaliseCode(ref)}`)
    .orderBy(desc(s.auditLog.id))
    .limit(20);
}

// ---------- Chats ----------

export async function listConversations(limit = 60) {
  const db = await getDb();
  const convs = await db
    .select()
    .from(s.conversations)
    .orderBy(sql`case when ${s.conversations.status} = 'open' then 0 else 1 end`, desc(s.conversations.lastMessageAt))
    .limit(limit);
  const ids = convs.map((c) => c.id);
  const last = ids.length
    ? await db
        .select({ conversationId: s.messages.conversationId, body: s.messages.body, sender: s.messages.sender, id: s.messages.id })
        .from(s.messages)
        .where(inArray(s.messages.conversationId, ids))
        .orderBy(desc(s.messages.id))
        .limit(600)
    : [];
  return convs.map((c) => ({ ...c, last: last.find((m) => m.conversationId === c.id) ?? null }));
}

export async function conversationThread(id: string) {
  const db = await getDb();
  const [c] = await db.select().from(s.conversations).where(eq(s.conversations.id, id));
  if (!c) return null;
  const msgs = await db.select().from(s.messages).where(eq(s.messages.conversationId, id)).orderBy(asc(s.messages.id)).limit(500);
  return { conversation: c, messages: msgs };
}

export async function staffReply(id: string, staffName: string, body: string) {
  const db = await getDb();
  const [c] = await db.select({ id: s.conversations.id }).from(s.conversations).where(eq(s.conversations.id, id));
  if (!c) return false;
  await db.insert(s.messages).values({ conversationId: id, sender: 'staff', staffName, body });
  await db
    .update(s.conversations)
    .set({
      status: 'open',
      unreadForStaff: 0,
      unreadForVisitor: sql`${s.conversations.unreadForVisitor} + 1`,
      lastMessageAt: new Date(),
    })
    .where(eq(s.conversations.id, id));
  return true;
}

export async function markConversationRead(id: string) {
  const db = await getDb();
  await db.update(s.conversations).set({ unreadForStaff: 0 }).where(eq(s.conversations.id, id));
}

export async function setConversationStatus(id: string, status: 'open' | 'closed') {
  const db = await getDb();
  await db
    .update(s.conversations)
    .set({ status, ...(status === 'closed' ? { unreadForStaff: 0 } : {}) })
    .where(eq(s.conversations.id, id));
}

// ---------- Enquiries and tables ----------

export const enquiryLabels: Record<EnquiryType, string> = {
  group: 'Group or celebration',
  corporate: 'Corporate team day',
  school: 'School visit',
  tour_operator: 'Tour operator',
  hotel: 'Hotel or backpackers',
  partner: 'Brand partnership',
  media: 'Media',
  venue: 'Venue hire or film shoot',
  base_jump: 'Base jump application',
  general: 'General',
};

export async function listEnquiries(status?: 'new' | 'replied' | 'closed') {
  const db = await getDb();
  return db
    .select()
    .from(s.enquiries)
    .where(status ? eq(s.enquiries.status, status) : undefined)
    .orderBy(sql`case when ${s.enquiries.status} = 'new' then 0 else 1 end`, desc(s.enquiries.createdAt))
    .limit(200);
}

export async function setEnquiryStatus(id: string, status: 'new' | 'replied' | 'closed') {
  const db = await getDb();
  await db.update(s.enquiries).set({ status }).where(eq(s.enquiries.id, id));
}

export async function listTableRequests() {
  const db = await getDb();
  const today = ymdInSast(new Date());
  return db
    .select()
    .from(s.tableRequests)
    .orderBy(
      sql`case when ${s.tableRequests.date} >= ${today} then 0 else 1 end`,
      sql`case when ${s.tableRequests.date} >= ${today} then ${s.tableRequests.date} end asc`,
      desc(s.tableRequests.date),
      asc(s.tableRequests.time),
    )
    .limit(200);
}

export async function tableRequest(id: string) {
  const db = await getDb();
  const [t] = await db.select().from(s.tableRequests).where(eq(s.tableRequests.id, id));
  return t ?? null;
}

export async function setTableStatus(id: string, status: 'requested' | 'confirmed' | 'declined') {
  const db = await getDb();
  await db.update(s.tableRequests).set({ status }).where(eq(s.tableRequests.id, id));
}

// ---------- Events ----------

export async function listEventsAdmin() {
  const db = await getDb();
  const rows = await db.select().from(s.events).orderBy(desc(s.events.startsAt));
  const sold = await db
    .select({ sku: s.bookingItems.sku, qty: sql<number>`coalesce(sum(${s.bookingItems.qty}), 0)` })
    .from(s.bookingItems)
    .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
    .where(and(eq(s.bookingItems.kind, 'event'), inArray(s.bookings.status, ['paid', 'pending_payment', 'held'])))
    .groupBy(s.bookingItems.sku);
  return rows.map((e) => ({ ...e, sold: Number(sold.find((x) => x.sku === e.id)?.qty ?? 0) }));
}

export async function eventAdmin(id: string) {
  const db = await getDb();
  const [e] = await db.select().from(s.events).where(eq(s.events.id, id));
  return e ?? null;
}

export type EventInput = {
  id?: string;
  slug: string;
  title: string;
  tag: string;
  summary: string;
  body: string;
  startsAt: Date;
  endsAt: Date;
  image: string;
  price: number | null;
  capacity: number;
  status: EventStatus;
};

export async function saveEvent(input: EventInput): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const db = await getDb();
  const clash = await db
    .select({ id: s.events.id })
    .from(s.events)
    .where(and(eq(s.events.slug, input.slug), input.id ? ne(s.events.id, input.id) : undefined));
  if (clash.length) return { ok: false, message: 'Another event already uses that web address (slug).' };
  const values = {
    slug: input.slug,
    title: input.title,
    tag: input.tag,
    summary: input.summary,
    body: input.body,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    image: input.image,
    price: input.price,
    capacity: input.capacity,
    status: input.status,
    updatedAt: new Date(),
  };
  if (input.id) {
    const updated = await db.update(s.events).set(values).where(eq(s.events.id, input.id)).returning({ id: s.events.id });
    if (!updated.length) return { ok: false, message: 'That event no longer exists.' };
    return { ok: true, id: input.id };
  }
  const [row] = await db.insert(s.events).values(values).returning({ id: s.events.id });
  return { ok: true, id: row!.id };
}

// ---------- Vouchers ----------

export async function listVouchers(q?: string) {
  const db = await getDb();
  const like = q?.trim() ? `%${q.trim()}%` : null;
  return db
    .select()
    .from(s.vouchers)
    .where(
      like
        ? or(ilike(s.vouchers.code, like), ilike(s.vouchers.recipientName, like), ilike(s.vouchers.purchaserName, like), ilike(s.vouchers.purchaserEmail, like))
        : undefined,
    )
    .orderBy(desc(s.vouchers.createdAt))
    .limit(200);
}

export async function issueCompVoucher(input: {
  label: string;
  value: number;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  message: string | null;
  staff: Pick<StaffSession, 'name' | 'email'>;
}) {
  const db = await getDb();
  const code = voucherCode();
  const token = secretToken();
  await db.insert(s.vouchers).values({
    code,
    kind: 'amount',
    sku: 'complimentary',
    label: input.label,
    value: input.value,
    balance: input.value,
    purchaserName: `Soweto Towers (${input.staff.name})`,
    purchaserEmail: input.staff.email,
    recipientName: input.recipientName,
    recipientEmail: input.recipientEmail,
    recipientPhone: input.recipientPhone,
    message: input.message,
    status: 'active',
    expiresAt: new Date(Date.now() + 365 * 86_400_000),
    token,
  });
  return { code, token };
}

export async function voidVoucher(code: string) {
  const db = await getDb();
  const updated = await db
    .update(s.vouchers)
    .set({ status: 'void' })
    .where(eq(s.vouchers.code, normaliseCode(code)))
    .returning({ code: s.vouchers.code });
  return updated.length > 0;
}

// ---------- Outbox ----------

export async function listNotifications(f: { channel?: string; status?: string; limit?: number }) {
  const db = await getDb();
  const conds = [];
  if (f.channel) conds.push(eq(s.notifications.channel, f.channel as 'email' | 'whatsapp' | 'push'));
  if (f.status) conds.push(eq(s.notifications.status, f.status as 'sent' | 'simulated' | 'failed'));
  return db
    .select()
    .from(s.notifications)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.notifications.id))
    .limit(f.limit ?? 150);
}

export async function audienceCounts() {
  const db = await getDb();
  const [byChannel, push] = await Promise.all([
    db.select({ channel: s.subscribers.channel, n: count() }).from(s.subscribers).where(isNull(s.subscribers.unsubscribedAt)).groupBy(s.subscribers.channel),
    db
      .select({ n: count() })
      .from(s.pushSubscriptions)
      .where(sql`${s.pushSubscriptions.topics} @> '["status"]'::jsonb`),
  ]);
  return {
    whatsapp: Number(byChannel.find((r) => r.channel === 'whatsapp')?.n ?? 0),
    email: Number(byChannel.find((r) => r.channel === 'email')?.n ?? 0),
    push: Number(push[0]?.n ?? 0),
  };
}

export async function subscribersCsv(): Promise<string> {
  const db = await getDb();
  const rows = await db.select().from(s.subscribers).where(isNull(s.subscribers.unsubscribedAt)).orderBy(asc(s.subscribers.id));
  const cell = (v: string) => {
    // Neutralise spreadsheet formulas and quote every value.
    const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
    return `"${safe.replace(/"/g, '""')}"`;
  };
  const lines = [['channel', 'address', 'source', 'consent_at'].join(',')];
  for (const r of rows) {
    lines.push([r.channel, r.address, r.source ?? '', r.consentAt.toISOString()].map(cell).join(','));
  }
  return `${lines.join('\r\n')}\r\n`;
}

// ---------- Reports ----------

/** Money actually taken for paid bookings. Voucher-covered amounts were counted when the voucher was sold. */
const cashTaken = sql<string>`coalesce(sum(${s.bookings.total} - ${s.bookings.voucherApplied}), 0)`;

export async function sourceBreakdown() {
  const db = await getDb();
  const rows = await db
    .select({ source: s.bookings.source, partner: s.bookings.partnerCode, bookings: count(), revenue: cashTaken })
    .from(s.bookings)
    .where(eq(s.bookings.status, 'paid'))
    .groupBy(s.bookings.source, s.bookings.partnerCode)
    .orderBy(desc(count()));
  return rows.map((r) => ({ source: r.source, partner: r.partner, bookings: Number(r.bookings), revenue: Number(r.revenue) }));
}

export async function packageMix() {
  const db = await getDb();
  const rows = await db
    .select({ packageId: s.bookings.packageId, bookings: count(), revenue: cashTaken })
    .from(s.bookings)
    .where(and(eq(s.bookings.status, 'paid'), eq(s.bookings.kind, 'adventure')))
    .groupBy(s.bookings.packageId)
    .orderBy(desc(count()));
  return rows.map((r) => ({
    label: r.packageId ? (getPackage(r.packageId)?.name ?? r.packageId) : 'Single adventures',
    bookings: Number(r.bookings),
    revenue: Number(r.revenue ?? 0),
  }));
}

export async function revenueByKind() {
  const db = await getDb();
  const rows = await db
    .select({ kind: s.bookings.kind, bookings: count(), revenue: cashTaken })
    .from(s.bookings)
    .where(eq(s.bookings.status, 'paid'))
    .groupBy(s.bookings.kind);
  const gate = await db.select({ revenue: sum(s.walkIns.amount), qty: sum(s.walkIns.qty) }).from(s.walkIns);
  return {
    online: rows.map((r) => ({ kind: r.kind, bookings: Number(r.bookings), revenue: Number(r.revenue ?? 0) })),
    gate: { revenue: Number(gate[0]?.revenue ?? 0), qty: Number(gate[0]?.qty ?? 0) },
  };
}

// ---------- Team ----------

export async function listStaff() {
  const db = await getDb();
  return db
    .select({
      id: s.staff.id,
      email: s.staff.email,
      name: s.staff.name,
      role: s.staff.role,
      totp: sql<boolean>`${s.staff.totpSecret} is not null`,
      lastLoginAt: s.staff.lastLoginAt,
      createdAt: s.staff.createdAt,
    })
    .from(s.staff)
    .orderBy(asc(s.staff.name));
}

export async function staffRow(id: string) {
  const db = await getDb();
  const [row] = await db.select().from(s.staff).where(eq(s.staff.id, id));
  return row ?? null;
}

export async function addStaff(input: { email: string; name: string; role: 'admin' | 'crew'; password: string }) {
  const db = await getDb();
  const email = input.email.trim().toLowerCase();
  const existing = await db.select({ id: s.staff.id }).from(s.staff).where(eq(s.staff.email, email));
  if (existing.length) return { ok: false as const, message: 'Someone with that email is already on the team.' };
  await db.insert(s.staff).values({
    email,
    name: input.name.trim(),
    role: input.role,
    passwordHash: await hashPassword(input.password),
  });
  return { ok: true as const };
}

export async function removeStaff(id: string) {
  const db = await getDb();
  await db.delete(s.staff).where(eq(s.staff.id, id));
}

/** Sets a new password and signs the person out everywhere; returns the new session version. */
export async function setPassword(id: string, password: string): Promise<number> {
  const db = await getDb();
  const [row] = await db
    .update(s.staff)
    .set({ passwordHash: await hashPassword(password), sessionVersion: sql`${s.staff.sessionVersion} + 1` })
    .where(eq(s.staff.id, id))
    .returning({ version: s.staff.sessionVersion });
  return row?.version ?? 0;
}

/**
 * Records a two-step code's time window as used. False if that window (or a
 * later one) was already used, so a code seen over someone's shoulder can't be
 * replayed within its 90-second life.
 */
export async function claimTotpStep(id: string, step: number): Promise<boolean> {
  const db = await getDb();
  const rows = await db
    .update(s.staff)
    .set({ totpLastStep: step })
    .where(and(eq(s.staff.id, id), or(isNull(s.staff.totpLastStep), lt(s.staff.totpLastStep, step))))
    .returning({ id: s.staff.id });
  return rows.length > 0;
}

export async function setTotpSecret(id: string, secret: string | null) {
  const db = await getDb();
  await db.update(s.staff).set({ totpSecret: secret, totpLastStep: null }).where(eq(s.staff.id, id));
}

export async function adminCount() {
  const db = await getDb();
  const [row] = await db.select({ n: count() }).from(s.staff).where(eq(s.staff.role, 'admin'));
  return Number(row?.n ?? 0);
}

export const walkInActivities = activities.filter((a) => a.booking.mode !== 'enquiry');
