import 'server-only';
import { and, eq, gt, gte, inArray, lt, lte, or, sql } from 'drizzle-orm';
import type { ActivityId } from '@/content/catalog';
import { buildSlots, liveActivities, type LiveActivity, type Slot } from '@/lib/booking/engine';
import { getDb, schema, type DB } from '@/lib/db';
import { dayHours, type DayHours, type HoursOverride } from '@/lib/hours';
import { addDays, diffDays, hmInSast, hmToMinutes, ymdInSast, type Hm, type Ymd } from '@/lib/time';
import type { CapacityConfig } from './settings-types';
import { getSetting } from './settings';

const ACTIVE: ('paid' | 'pending_payment' | 'held')[] = ['paid', 'pending_payment', 'held'];

/** Release unpaid holds that ran out, restoring any voucher balance they reserved. */
export async function expireHolds(db?: DB): Promise<number> {
  const d = db ?? (await getDb());
  const now = new Date();
  const expired = await d
    .update(schema.bookings)
    .set({ status: 'expired', updatedAt: now })
    .where(and(inArray(schema.bookings.status, ['held', 'pending_payment']), lt(schema.bookings.holdExpiresAt, now)))
    .returning({ voucherCode: schema.bookings.voucherCode, applied: schema.bookings.voucherApplied });
  for (const b of expired) {
    if (b.voucherCode && b.applied > 0) {
      await d
        .update(schema.vouchers)
        .set({ balance: sql`${schema.vouchers.balance} + ${b.applied}`, status: 'active' })
        .where(eq(schema.vouchers.code, b.voucherCode));
    }
  }
  return expired.length;
}

/** Capacity units taken per day and start time for a resource (paid, paying, or held). */
export async function usedUnits(db: DB, resource: string, from: Ymd, to: Ymd): Promise<Record<Ymd, Record<Hm, number>>> {
  const now = new Date();
  const rows = await db
    .select({
      date: schema.bookingItems.slotDate,
      time: schema.bookingItems.slotTime,
      units: sql<number>`coalesce(sum(${schema.bookingItems.units}), 0)`,
    })
    .from(schema.bookingItems)
    .innerJoin(schema.bookings, eq(schema.bookingItems.bookingId, schema.bookings.id))
    .where(
      and(
        eq(schema.bookingItems.resource, resource),
        gte(schema.bookingItems.slotDate, from),
        lte(schema.bookingItems.slotDate, to),
        eq(schema.bookingItems.kind, 'activity'),
        inArray(schema.bookings.status, ACTIVE),
        or(eq(schema.bookings.status, 'paid'), gt(schema.bookings.holdExpiresAt, now)),
      ),
    )
    .groupBy(schema.bookingItems.slotDate, schema.bookingItems.slotTime);
  const out: Record<Ymd, Record<Hm, number>> = {};
  for (const r of rows) {
    if (!r.date || !r.time) continue;
    (out[r.date] ??= {})[r.time] = Number(r.units);
  }
  return out;
}

type Ctx = {
  db: DB;
  cfg: CapacityConfig;
  overrides: HoursOverride[];
  activity: LiveActivity | undefined;
  today: Ymd;
  nowMinutes: number;
};

async function context(activityId: ActivityId): Promise<Ctx> {
  const [db, cfg, overrides, prices] = await Promise.all([getDb(), getSetting('capacity'), getSetting('hours_overrides'), getSetting('price_overrides')]);
  const now = new Date();
  return {
    db,
    cfg,
    overrides,
    activity: liveActivities(prices).find((a) => a.id === activityId),
    today: ymdInSast(now),
    nowMinutes: hmToMinutes(hmInSast(now)),
  };
}

export type DayAvailability = { day: DayHours; slots: Slot[]; bookable: boolean; reason?: string };

function evaluate(ctx: Ctx, date: Ymd, used: Record<Hm, number>): DayAvailability {
  const { activity, cfg, overrides, today } = ctx;
  const day = dayHours(date, overrides);
  if (!activity || activity.booking.mode === 'enquiry') return { day, slots: [], bookable: false, reason: 'Not bookable online' };
  if (activity.disabled) return { day, slots: [], bookable: false, reason: 'Paused by the crew' };
  const ahead = diffDays(today, date);
  if (ahead < 0) return { day, slots: [], bookable: false, reason: 'That date has passed' };
  if (ahead > cfg.horizonDays) return { day, slots: [], bookable: false, reason: 'Not open for booking yet' };
  if (!day.open) return { day, slots: [], bookable: false, reason: 'Closed' };
  const slots = buildSlots(activity, day, cfg, used, { date: today, minutes: ctx.nowMinutes });
  if (slots.length === 0) return { day, slots, bookable: false, reason: 'No sessions this day' };
  return { day, slots, bookable: slots.some((s) => !s.closed && s.remaining > 0) };
}

export async function dayAvailability(activityId: ActivityId, date: Ymd): Promise<DayAvailability> {
  const ctx = await context(activityId);
  await expireHolds(ctx.db);
  const resource = ctx.activity && ctx.activity.booking.mode !== 'enquiry' ? ctx.activity.booking.resource : null;
  const used = resource ? ((await usedUnits(ctx.db, resource, date, date))[date] ?? {}) : {};
  return evaluate(ctx, date, used);
}

export type RangeDay = { date: Ymd; open: boolean; bookable: boolean; sunset: string; opensAt: string | null; spaces: number };

/** Open/closed and spaces left for each day from `from` for `days` days, in two queries. */
export async function rangeAvailability(activityId: ActivityId, from: Ymd, days: number): Promise<RangeDay[]> {
  const ctx = await context(activityId);
  await expireHolds(ctx.db);
  const to = addDays(from, days - 1);
  const resource = ctx.activity && ctx.activity.booking.mode !== 'enquiry' ? ctx.activity.booking.resource : null;
  const usage = resource ? await usedUnits(ctx.db, resource, from, to) : {};
  const out: RangeDay[] = [];
  for (let i = 0; i < days; i++) {
    const date = addDays(from, i);
    const a = evaluate(ctx, date, usage[date] ?? {});
    out.push({
      date,
      open: a.day.open,
      bookable: a.bookable,
      sunset: a.day.sunset,
      opensAt: a.day.opensAt,
      spaces: a.slots.filter((s) => !s.closed).reduce((n, s) => n + s.remaining, 0),
    });
  }
  return out;
}
