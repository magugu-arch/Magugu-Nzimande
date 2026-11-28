import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, sum } from 'drizzle-orm';
import { activities, getActivity, getPackage, type ActivityId } from '@/content/catalog';
import { buildSlots, liveActivities, quote, safetyErrors, type CartItem } from '@/lib/booking/engine';
import { bookingRequestSchema, eventOrderSchema, voucherOrderSchema, zodErrors } from '@/lib/booking/request';
import { getDb, schema, type DB } from '@/lib/db';
import { dayHours } from '@/lib/hours';
import { bookingRef, normaliseCode, secretToken, voucherCode } from '@/lib/ids';
import { notifyBookingConfirmed, notifyStaff, notifyVoucher } from '@/lib/notify';
import { startPayment, type PaymentInit } from '@/lib/payments';
import { addDays, hmInSast, hmToMinutes, ymdInSast } from '@/lib/time';
import { expireHolds, usedUnits } from './availability';
import { getSetting } from './settings';

export type Result<T> = { ok: true; value: T } | { ok: false; errors: string[] };
export type Created = { id: string; ref: string; payment: PaymentInit | null; ticketUrl: string | null };

class BookingError extends Error {}

const s = schema;

function summaryFor(packageId: string | null, items: { activityId: ActivityId; qty: number }[]): string {
  const people = Math.max(...items.map((i) => i.qty));
  const pkg = packageId ? getPackage(packageId) : null;
  if (pkg) return `${pkg.name} for ${people}`;
  return items.map((i) => `${getActivity(i.activityId)?.name ?? i.activityId} for ${i.qty}`).join(' + ');
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// ---------- Adventures ----------

export async function createAdventureBooking(raw: unknown, ctx: { source?: string | null; partner?: string | null }): Promise<Result<Created>> {
  const parsed = bookingRequestSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const req = parsed.data;

  const [prices, cfg, overrides] = await Promise.all([getSetting('price_overrides'), getSetting('capacity'), getSetting('hours_overrides')]);
  const catalog = liveActivities(prices);
  const items: CartItem[] = req.items;
  const q = quote(items, req.packageId, catalog);
  if (q.errors.length) return { ok: false, errors: q.errors };

  const people = Math.max(...items.map((i) => i.qty));
  if (req.participants.length !== people) {
    return { ok: false, errors: [`Add details for all ${people} people.`] };
  }
  const booked = catalog.filter((a) => items.some((i) => i.activityId === a.id));
  const safety = safetyErrors(booked, { participants: req.participants, ...req.safety });
  if (safety.length) return { ok: false, errors: safety };

  const day = dayHours(req.date, overrides);
  if (!day.open) return { ok: false, errors: ['The towers are closed on that day. Pick another date.'] };

  const db = await getDb();
  await expireHolds(db);
  const now = new Date();
  const nowCtx = { date: ymdInSast(now), minutes: hmToMinutes(hmInSast(now)) };
  const code = req.voucherCode ? normaliseCode(req.voucherCode) : '';

  let created: { id: string; ref: string; payable: number; token: string };
  try {
    created = await db.transaction(async (tx) => {
      const t = tx as unknown as DB;
      for (const line of q.lines.filter((l) => l.kind === 'activity')) {
        const a = catalog.find((x) => x.id === line.activityId)!;
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${line.resource}:${req.date}`}))`);
        const used = (await usedUnits(t, line.resource!, req.date, req.date))[req.date] ?? {};
        const slot = buildSlots(a, day, cfg, used, nowCtx).find((x) => x.time === line.time);
        if (!slot || slot.closed) throw new BookingError(`${a.name} at ${line.time} can’t be booked any more. Pick another time.`);
        if (slot.remaining < (line.units ?? 0)) {
          throw new BookingError(
            slot.remaining === 0
              ? `${a.name} at ${line.time} just filled up. Pick another time.`
              : `Only ${slot.remaining} ${slot.remaining === 1 ? 'place is' : 'places are'} left for ${a.name} at ${line.time}.`,
          );
        }
      }

      let applied = 0;
      if (code) {
        const [v] = await tx.select().from(s.vouchers).where(eq(s.vouchers.code, code)).for('update');
        if (!v || v.status !== 'active' || v.balance <= 0) throw new BookingError('That voucher code isn’t valid or has been used.');
        if (v.expiresAt < now) throw new BookingError('That voucher has expired.');
        applied = Math.min(v.balance, q.total);
        await tx
          .update(s.vouchers)
          .set({ balance: v.balance - applied, status: v.balance - applied === 0 ? 'redeemed' : 'active' })
          .where(eq(s.vouchers.code, code));
      }

      const payable = q.total - applied;
      const ref = bookingRef();
      const token = secretToken();
      const [b] = await tx
        .insert(s.bookings)
        .values({
          ref,
          kind: 'adventure',
          status: payable === 0 ? 'paid' : 'pending_payment',
          visitDate: req.date,
          name: req.contact.name,
          email: req.contact.email.toLowerCase(),
          phone: req.contact.phone,
          notifyWhatsapp: req.consents.whatsapp,
          marketingOptIn: req.consents.marketing,
          clipConsent: req.consents.clip,
          packageId: q.packageId,
          subtotal: q.subtotal,
          discount: q.packageSaving,
          voucherApplied: applied,
          total: q.total,
          voucherCode: code || null,
          source: ctx.source ?? null,
          partnerCode: ctx.partner ?? null,
          paidAt: payable === 0 ? now : null,
          paymentProvider: payable === 0 ? 'voucher' : null,
          holdExpiresAt: new Date(now.getTime() + cfg.holdMinutes * 60_000),
          ticketToken: token,
          waiver: {
            signedName: req.contact.name,
            signedAt: now.toISOString(),
            acceptedMedical: req.safety.medicalOk,
            acceptedTerms: true,
            guardian: req.participants.some((p) => p.minor)
              ? { name: req.safety.guardianName, for: req.participants.filter((p) => p.minor).map((p) => p.name) }
              : null,
          },
          meta: { summary: summaryFor(q.packageId, items), groupSaving: q.groupSaving },
        })
        .returning({ id: s.bookings.id });

      await tx.insert(s.bookingItems).values(
        q.lines.map((l) => ({
          bookingId: b!.id,
          kind: l.kind,
          sku: l.sku,
          label: l.label,
          slotDate: l.kind === 'activity' ? req.date : null,
          slotTime: l.kind === 'activity' ? (l.time ?? null) : null,
          resource: l.kind === 'activity' ? (l.resource ?? null) : null,
          units: l.units ?? 0,
          qty: l.qty,
          unitPrice: l.unitPrice,
          total: l.total,
          meta: l.groupRate ? { groupRate: true } : {},
        })),
      );
      await tx.insert(s.participants).values(
        req.participants.map((p) => ({
          bookingId: b!.id,
          name: p.name,
          weightKg: p.weightKg == null ? null : Math.round(p.weightKg),
          ageBand: p.minor ? ('minor' as const) : ('adult' as const),
          activities: items.map((i) => i.activityId),
        })),
      );
      if (req.lunch) {
        await tx.insert(s.tableRequests).values({
          name: req.contact.name,
          phone: req.contact.phone,
          email: req.contact.email,
          date: req.date,
          time: req.lunch.time,
          partySize: req.lunch.partySize,
          bookingRef: ref,
          notes: 'Jump & Lunch, added at booking',
        });
      }
      return { id: b!.id, ref, payable, token };
    });
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, errors: [err.message] };
    throw err;
  }

  if (created.payable === 0) {
    await finalize(created.id);
    return { ok: true, value: { id: created.id, ref: created.ref, payment: null, ticketUrl: `/ticket/${created.ref}?t=${created.token}` } };
  }

  const { provider, init } = startPayment({
    id: created.id,
    ref: created.ref,
    amount: created.payable,
    itemName: summaryFor(q.packageId, items),
    name: req.contact.name,
    email: req.contact.email,
    phone: req.contact.phone,
  });
  await db.update(s.bookings).set({ paymentProvider: provider }).where(eq(s.bookings.id, created.id));
  return { ok: true, value: { id: created.id, ref: created.ref, payment: init, ticketUrl: null } };
}

// ---------- Gift a Jump vouchers ----------

function voucherProduct(p: { type: 'package' | 'activity' | 'amount'; id?: string; amount?: number }) {
  if (p.type === 'package') {
    const pkg = getPackage(p.id!)!;
    return { kind: 'package' as const, sku: pkg.id, label: pkg.name, value: pkg.price };
  }
  if (p.type === 'activity') {
    const a = getActivity(p.id!)!;
    return { kind: 'activity' as const, sku: a.id, label: a.name, value: a.price };
  }
  return { kind: 'amount' as const, sku: 'amount', label: `R${p.amount} gift voucher`, value: p.amount! };
}

export async function createVoucherOrder(raw: unknown, ctx: { source?: string | null; partner?: string | null }): Promise<Result<Created>> {
  const parsed = voucherOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const o = parsed.data;
  if (o.delivery === 'email' && !o.recipient.email) return { ok: false, errors: ['Add the recipient’s email address.'] };
  if (o.delivery === 'whatsapp' && !o.recipient.phone) return { ok: false, errors: ['Add the recipient’s WhatsApp number.'] };
  if (o.product.type === 'activity') {
    const a = getActivity(o.product.id);
    if (!a || a.booking.mode === 'enquiry') return { ok: false, errors: ['Choose an adventure that can be booked online.'] };
  }
  const product = voucherProduct(o.product);
  const total = product.value * o.quantity;
  const db = await getDb();
  const ref = bookingRef();
  const token = secretToken();
  const [b] = await db
    .insert(s.bookings)
    .values({
      ref,
      kind: 'voucher',
      status: 'pending_payment',
      name: o.purchaser.name,
      email: o.purchaser.email.toLowerCase(),
      phone: o.purchaser.phone,
      marketingOptIn: o.consents.marketing,
      subtotal: total,
      total,
      source: ctx.source ?? null,
      partnerCode: ctx.partner ?? null,
      holdExpiresAt: new Date(Date.now() + 60 * 60_000),
      ticketToken: token,
      meta: {
        summary: `${o.quantity} × ${product.label} voucher`,
        voucher: { ...product, recipient: o.recipient, message: o.message, delivery: o.delivery, deliverOn: o.deliverOn || null },
      },
    })
    .returning({ id: s.bookings.id });
  await db.insert(s.bookingItems).values({
    bookingId: b!.id,
    kind: 'voucher',
    sku: `${product.kind}:${product.sku}`,
    label: `Gift a Jump · ${product.label}`,
    qty: o.quantity,
    unitPrice: product.value,
    total,
  });
  const { provider, init } = startPayment({
    id: b!.id,
    ref,
    amount: total,
    itemName: `Gift a Jump ${product.label}`,
    name: o.purchaser.name,
    email: o.purchaser.email,
    phone: o.purchaser.phone,
  });
  await db.update(s.bookings).set({ paymentProvider: provider }).where(eq(s.bookings.id, b!.id));
  return { ok: true, value: { id: b!.id, ref, payment: init, ticketUrl: null } };
}

async function issueVouchers(tx: DB, bookingId: string) {
  const [b] = await tx.select().from(s.bookings).where(eq(s.bookings.id, bookingId));
  const meta = (b?.meta ?? {}) as {
    voucher?: {
      kind: 'amount' | 'package' | 'activity';
      sku: string;
      label: string;
      value: number;
      recipient: { name: string; email?: string; phone?: string };
      message: string;
      deliverOn: string | null;
    };
  };
  const items = await tx.select().from(s.bookingItems).where(eq(s.bookingItems.bookingId, bookingId));
  if (!b || !meta.voucher) return;
  const v = meta.voucher;
  const qty = items.find((i) => i.kind === 'voucher')?.qty ?? 1;
  const expires = new Date(Date.now() + 365 * 86_400_000);
  for (let i = 0; i < qty; i++) {
    await tx.insert(s.vouchers).values({
      code: voucherCode(),
      kind: v.kind,
      sku: v.sku,
      label: v.label,
      value: v.value,
      balance: v.value,
      purchaserName: b.name,
      purchaserEmail: b.email,
      recipientName: v.recipient.name,
      recipientEmail: v.recipient.email || null,
      recipientPhone: v.recipient.phone || null,
      message: v.message || null,
      deliverOn: v.deliverOn,
      status: 'active',
      expiresAt: expires,
      purchaseBookingId: b.id,
      token: secretToken(),
    });
  }
}

/** Send any vouchers whose delivery day has come. Run on payment and by the daily cron. */
export async function deliverDueVouchers(bookingId?: string): Promise<number> {
  const db = await getDb();
  const today = ymdInSast(new Date());
  const rows = await db
    .select({ v: s.vouchers, b: s.bookings })
    .from(s.vouchers)
    .innerJoin(s.bookings, eq(s.vouchers.purchaseBookingId, s.bookings.id))
    .where(
      and(
        eq(s.vouchers.status, 'active'),
        sql`${s.vouchers.deliveredAt} is null`,
        or(sql`${s.vouchers.deliverOn} is null`, lte(s.vouchers.deliverOn, today)),
        bookingId ? eq(s.vouchers.purchaseBookingId, bookingId) : undefined,
      ),
    );
  for (const { v, b } of rows) {
    const delivery = (b.meta as { voucher?: { delivery?: 'email' | 'whatsapp' | 'me' } }).voucher?.delivery ?? 'me';
    await notifyVoucher({
      code: v.code,
      token: v.token,
      label: v.label,
      recipientName: v.recipientName,
      recipientEmail: v.recipientEmail,
      recipientPhone: v.recipientPhone,
      purchaserName: v.purchaserName,
      purchaserEmail: v.purchaserEmail,
      message: v.message,
      delivery,
      expiresAt: v.expiresAt,
    });
    await db.update(s.vouchers).set({ deliveredAt: new Date() }).where(eq(s.vouchers.code, v.code));
  }
  return rows.length;
}

export async function checkVoucher(input: string) {
  const code = normaliseCode(input);
  if (!/^GIFT-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) return { valid: false as const, reason: 'Check the code: it looks like GIFT-XXXX-XXXX.' };
  const db = await getDb();
  const [v] = await db.select().from(s.vouchers).where(eq(s.vouchers.code, code));
  if (!v) return { valid: false as const, reason: 'We can’t find that code.' };
  if (v.status !== 'active' || v.balance <= 0) return { valid: false as const, reason: 'That voucher has been used.' };
  if (v.expiresAt < new Date()) return { valid: false as const, reason: 'That voucher has expired.' };
  return { valid: true as const, code: v.code, label: v.label, balance: v.balance, expiresAt: v.expiresAt.toISOString().slice(0, 10) };
}

export async function getVoucherForPage(code: string, token: string) {
  const db = await getDb();
  const [v] = await db
    .select()
    .from(s.vouchers)
    .where(eq(s.vouchers.code, normaliseCode(code)));
  if (!v || !safeEqual(v.token, token)) return null;
  return v;
}

export async function vouchersForBooking(bookingId: string) {
  const db = await getDb();
  return db.select().from(s.vouchers).where(eq(s.vouchers.purchaseBookingId, bookingId));
}

// ---------- Events ----------

export async function createEventBooking(raw: unknown, ctx: { source?: string | null; partner?: string | null }): Promise<Result<Created>> {
  const parsed = eventOrderSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error) };
  const o = parsed.data;
  const db = await getDb();
  await expireHolds(db);
  try {
    const created = await db.transaction(async (tx) => {
      const [e] = await tx.select().from(s.events).where(eq(s.events.slug, o.slug)).for('update');
      if (!e || e.status !== 'published') throw new BookingError('That event isn’t available.');
      if (e.endsAt < new Date()) throw new BookingError('That event has finished.');
      const [{ taken }] = (await tx
        .select({ taken: sql<number>`coalesce(sum(${s.bookingItems.qty}), 0)` })
        .from(s.bookingItems)
        .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
        .where(and(eq(s.bookingItems.kind, 'event'), eq(s.bookingItems.sku, e.id), inArray(s.bookings.status, ['paid', 'pending_payment', 'held'])))) as [
        { taken: number },
      ];
      const left = e.capacity - Number(taken);
      if (left < o.qty) throw new BookingError(left <= 0 ? 'That event is full.' : `Only ${left} places left.`);
      const unit = e.price ?? 0;
      const total = unit * o.qty;
      const ref = bookingRef();
      const token = secretToken();
      const now = new Date();
      const [b] = await tx
        .insert(s.bookings)
        .values({
          ref,
          kind: 'event',
          status: total === 0 ? 'paid' : 'pending_payment',
          visitDate: ymdInSast(e.startsAt),
          name: o.contact.name,
          email: o.contact.email.toLowerCase(),
          phone: o.contact.phone,
          notifyWhatsapp: o.consents.whatsapp,
          marketingOptIn: o.consents.marketing,
          subtotal: total,
          total,
          paidAt: total === 0 ? now : null,
          paymentProvider: total === 0 ? 'free' : null,
          holdExpiresAt: new Date(now.getTime() + 20 * 60_000),
          ticketToken: token,
          source: ctx.source ?? null,
          partnerCode: ctx.partner ?? null,
          meta: { summary: `${e.title} · ${o.qty} ${o.qty === 1 ? 'ticket' : 'tickets'}`, eventSlug: e.slug },
        })
        .returning({ id: s.bookings.id });
      await tx.insert(s.bookingItems).values({
        bookingId: b!.id,
        kind: 'event',
        sku: e.id,
        label: e.title,
        slotDate: ymdInSast(e.startsAt),
        slotTime: hmInSast(e.startsAt),
        qty: o.qty,
        unitPrice: unit,
        total,
      });
      return { id: b!.id, ref, token, total, title: e.title };
    });
    if (created.total === 0) {
      await finalize(created.id);
      return { ok: true, value: { id: created.id, ref: created.ref, payment: null, ticketUrl: `/ticket/${created.ref}?t=${created.token}` } };
    }
    const { provider, init } = startPayment({
      id: created.id,
      ref: created.ref,
      amount: created.total,
      itemName: created.title,
      name: o.contact.name,
      email: o.contact.email,
      phone: o.contact.phone,
    });
    await db.update(s.bookings).set({ paymentProvider: provider }).where(eq(s.bookings.id, created.id));
    return { ok: true, value: { id: created.id, ref: created.ref, payment: init, ticketUrl: null } };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, errors: [err.message] };
    throw err;
  }
}

export async function eventSpacesLeft(eventId: string, capacity: number): Promise<number> {
  const db = await getDb();
  const [{ taken }] = (await db
    .select({ taken: sql<number>`coalesce(sum(${s.bookingItems.qty}), 0)` })
    .from(s.bookingItems)
    .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
    .where(and(eq(s.bookingItems.kind, 'event'), eq(s.bookingItems.sku, eventId), inArray(s.bookings.status, ['paid', 'pending_payment', 'held'])))) as [
    { taken: number },
  ];
  return Math.max(0, capacity - Number(taken));
}

// ---------- Payment completion ----------

/** Idempotent: PayFast may notify more than once, and the return page polls too. */
export async function markPaid(
  bookingId: string,
  p: { provider: string; paymentRef: string; amount: number | null },
): Promise<{ ok: boolean; already?: boolean; reason?: string }> {
  const db = await getDb();
  const out = await db.transaction(async (tx) => {
    const [b] = await tx.select().from(s.bookings).where(eq(s.bookings.id, bookingId)).for('update');
    if (!b) return { ok: false, reason: 'not found' };
    if (b.status === 'paid') return { ok: true, already: true };
    if (b.status === 'refunded') return { ok: false, reason: 'refunded' };
    const payable = b.total - b.voucherApplied;
    if (p.amount != null && Math.abs(p.amount - payable) > 0.01) return { ok: false, reason: `amount ${p.amount} != ${payable}` };
    const late = b.status === 'expired' || b.status === 'cancelled';
    if (late && b.voucherCode && b.voucherApplied > 0) {
      await tx
        .update(s.vouchers)
        .set({ balance: sql`greatest(${s.vouchers.balance} - ${b.voucherApplied}, 0)` })
        .where(eq(s.vouchers.code, b.voucherCode));
    }
    await tx
      .update(s.bookings)
      .set({
        status: 'paid',
        paidAt: new Date(),
        paymentProvider: p.provider,
        paymentRef: p.paymentRef,
        meta: late ? { ...b.meta, paidAfterHoldExpired: true } : b.meta,
        updatedAt: new Date(),
      })
      .where(eq(s.bookings.id, bookingId));
    if (b.kind === 'voucher') await issueVouchers(tx as unknown as DB, bookingId);
    return { ok: true, late };
  });
  if (out.ok && !('already' in out && out.already)) {
    await finalize(bookingId);
    if ('late' in out && out.late) {
      await notifyStaff(
        'Payment arrived after a hold expired',
        [`Booking ${bookingId} was paid after its hold ran out. Check the slot isn’t over capacity.`],
        `/admin/bookings`,
      );
    }
  }
  return out;
}

async function finalize(bookingId: string) {
  const detail = await bookingById(bookingId);
  if (!detail) return;
  const { booking: b, items } = detail;
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
  if (b.kind === 'voucher') await deliverDueVouchers(b.id);
}

export async function cancelPending(bookingId: string): Promise<void> {
  const db = await getDb();
  const [b] = await db.select().from(s.bookings).where(eq(s.bookings.id, bookingId));
  if (!b || !['pending_payment', 'held'].includes(b.status)) return;
  await db.update(s.bookings).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(s.bookings.id, bookingId));
  if (b.voucherCode && b.voucherApplied > 0) {
    await db
      .update(s.vouchers)
      .set({ balance: sql`${s.vouchers.balance} + ${b.voucherApplied}`, status: 'active' })
      .where(eq(s.vouchers.code, b.voucherCode));
  }
}

// ---------- Reads ----------

export async function bookingById(id: string) {
  const db = await getDb();
  const [booking] = await db.select().from(s.bookings).where(eq(s.bookings.id, id));
  if (!booking) return null;
  const [items, people] = await Promise.all([
    db.select().from(s.bookingItems).where(eq(s.bookingItems.bookingId, id)).orderBy(asc(s.bookingItems.id)),
    db.select().from(s.participants).where(eq(s.participants.bookingId, id)).orderBy(asc(s.participants.id)),
  ]);
  return { booking, items, people };
}

export async function bookingByRef(ref: string) {
  const db = await getDb();
  const [b] = await db
    .select({ id: s.bookings.id })
    .from(s.bookings)
    .where(eq(s.bookings.ref, normaliseCode(ref)));
  return b ? bookingById(b.id) : null;
}

export async function ticketFor(ref: string, token: string) {
  const d = await bookingByRef(ref);
  if (!d || !token || !safeEqual(d.booking.ticketToken, token)) return null;
  return d;
}

/** Visitors look up their booking with the reference and the email they booked with. */
export async function bookingForVisitor(ref: string, email: string) {
  const d = await bookingByRef(ref);
  if (!d || d.booking.email !== email.trim().toLowerCase()) return null;
  return d;
}

export async function clipsFor(ref: string) {
  const db = await getDb();
  return db
    .select()
    .from(s.clips)
    .where(eq(s.clips.bookingRef, normaliseCode(ref)))
    .orderBy(desc(s.clips.createdAt));
}

// ---------- Staff ----------

export async function checkIn(refOrUrl: string, staffName: string) {
  const match = refOrUrl.match(/ST-[A-Z0-9]{6}/i);
  const token = (() => {
    try {
      return new URL(refOrUrl).searchParams.get('t');
    } catch {
      return null;
    }
  })();
  if (!match) return { ok: false as const, message: 'That isn’t a Soweto Towers ticket.' };
  const d = await bookingByRef(match[0]);
  if (!d) return { ok: false as const, message: `No booking ${match[0].toUpperCase()}.` };
  if (token && !safeEqual(d.booking.ticketToken, token)) return { ok: false as const, message: 'This QR code doesn’t match the booking.' };
  if (d.booking.status !== 'paid') return { ok: false as const, message: `Booking ${d.booking.ref} is ${d.booking.status.replace('_', ' ')}, not paid.` };
  const today = ymdInSast(new Date());
  const wrongDay = d.booking.visitDate && d.booking.visitDate !== today;
  if (d.booking.checkedInAt) {
    return { ok: true as const, already: true, booking: d, message: `Already checked in at ${hmInSast(d.booking.checkedInAt)}.`, wrongDay };
  }
  const db = await getDb();
  await db.update(s.bookings).set({ checkedInAt: new Date(), checkedInBy: staffName }).where(eq(s.bookings.id, d.booking.id));
  return { ok: true as const, already: false, booking: d, message: 'Checked in.', wrongDay };
}

export async function listBookings(f: { date?: string; q?: string; status?: string; limit?: number }) {
  const db = await getDb();
  const conds = [];
  if (f.date) conds.push(eq(s.bookings.visitDate, f.date));
  if (f.status) conds.push(eq(s.bookings.status, f.status as never));
  if (f.q) {
    const like = `%${f.q.trim()}%`;
    conds.push(or(ilike(s.bookings.ref, like), ilike(s.bookings.name, like), ilike(s.bookings.email, like), ilike(s.bookings.phone, like)));
  }
  const rows = await db
    .select()
    .from(s.bookings)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(s.bookings.createdAt))
    .limit(f.limit ?? 100);
  const ids = rows.map((r) => r.id);
  const items = ids.length ? await db.select().from(s.bookingItems).where(inArray(s.bookingItems.bookingId, ids)) : [];
  return rows.map((b) => ({ ...b, items: items.filter((i) => i.bookingId === b.id) }));
}

export async function todaysSchedule(date: string) {
  const db = await getDb();
  const rows = await db
    .select({ item: s.bookingItems, booking: s.bookings })
    .from(s.bookingItems)
    .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
    .where(and(eq(s.bookingItems.slotDate, date), eq(s.bookingItems.kind, 'activity'), eq(s.bookings.status, 'paid')))
    .orderBy(asc(s.bookingItems.slotTime));
  return rows;
}

/** The North Star: paid adventure participants per month, online and at the gate. */
export async function participantsReport(months = 6) {
  const db = await getDb();
  const today = ymdInSast(new Date());
  const start = `${addDays(today, -31 * (months - 1)).slice(0, 7)}-01`;
  const online = await db
    .select({ month: sql<string>`to_char(${s.bookingItems.slotDate}, 'YYYY-MM')`, people: sum(s.bookingItems.qty) })
    .from(s.bookingItems)
    .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
    .where(and(eq(s.bookingItems.kind, 'activity'), eq(s.bookings.status, 'paid'), gte(s.bookingItems.slotDate, start)))
    .groupBy(sql`to_char(${s.bookingItems.slotDate}, 'YYYY-MM')`);
  const gate = await db
    .select({ month: sql<string>`to_char(${s.walkIns.date}, 'YYYY-MM')`, people: sum(s.walkIns.qty) })
    .from(s.walkIns)
    .where(gte(s.walkIns.date, start))
    .groupBy(sql`to_char(${s.walkIns.date}, 'YYYY-MM')`);
  const months_: Record<string, { online: number; gate: number }> = {};
  for (const r of online) (months_[r.month] ??= { online: 0, gate: 0 }).online = Number(r.people ?? 0);
  for (const r of gate) (months_[r.month] ??= { online: 0, gate: 0 }).gate = Number(r.people ?? 0);
  return Object.entries(months_)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, ...v, total: v.online + v.gate }));
}

/** Public social proof: participants this month (online + gate). Only real numbers. */
export async function jumpedThisMonth(): Promise<number> {
  const db = await getDb();
  const month = ymdInSast(new Date()).slice(0, 7);
  const [{ online }] = (await db
    .select({ online: sql<number>`coalesce(sum(${s.bookingItems.qty}), 0)` })
    .from(s.bookingItems)
    .innerJoin(s.bookings, eq(s.bookingItems.bookingId, s.bookings.id))
    .where(
      and(
        eq(s.bookingItems.kind, 'activity'),
        inArray(s.bookingItems.sku, ['bungee-jump', 'straightjacket-bungee', 'scad-freefall']),
        eq(s.bookings.status, 'paid'),
        sql`to_char(${s.bookingItems.slotDate}, 'YYYY-MM') = ${month}`,
        sql`${s.bookingItems.slotDate} <= current_date`,
      ),
    )) as [{ online: number }];
  const [{ gate }] = (await db
    .select({ gate: sql<number>`coalesce(sum(${s.walkIns.qty}), 0)` })
    .from(s.walkIns)
    .where(
      and(sql`to_char(${s.walkIns.date}, 'YYYY-MM') = ${month}`, inArray(s.walkIns.activityId, ['bungee-jump', 'straightjacket-bungee', 'scad-freefall'])),
    )) as [{ gate: number }];
  return Number(online) + Number(gate);
}

export const ALL_ACTIVITY_IDS = activities.map((a) => a.id);
