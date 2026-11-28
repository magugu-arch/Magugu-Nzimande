import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db';
import { expireHolds } from '@/lib/data/availability';
import { deliverDueVouchers } from '@/lib/data/bookings';
import { notifyFollowUp, notifyReminder } from '@/lib/notify';
import { addDays, ymdInSast } from '@/lib/time';

/**
 * Daily jobs (Vercel Cron at 17:00 SAST, or any scheduler calling with the
 * CRON_SECRET bearer token): release stale holds, send tomorrow's reminders,
 * welcome yesterday's jumpers to the #100mClub and deliver scheduled vouchers.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  const db = await getDb();
  const today = ymdInSast(new Date());
  const tomorrow = addDays(today, 1);
  const yesterday = addDays(today, -1);

  const expired = await expireHolds(db);

  const due = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.status, 'paid'), eq(schema.bookings.visitDate, tomorrow), isNull(schema.bookings.reminderSentAt)));
  for (const b of due) {
    const [first] = await db
      .select({ t: sql<string>`min(${schema.bookingItems.slotTime})` })
      .from(schema.bookingItems)
      .where(eq(schema.bookingItems.bookingId, b.id));
    await notifyReminder({
      ref: b.ref,
      name: b.name,
      email: b.email,
      phone: b.phone,
      notifyWhatsapp: b.notifyWhatsapp,
      firstTime: first?.t ?? null,
      ticketToken: b.ticketToken,
      summary: String((b.meta as { summary?: string }).summary ?? 'your visit'),
    });
    await db.update(schema.bookings).set({ reminderSentAt: new Date() }).where(eq(schema.bookings.id, b.id));
  }

  const visited = await db
    .select()
    .from(schema.bookings)
    .where(and(eq(schema.bookings.status, 'paid'), eq(schema.bookings.visitDate, yesterday), isNull(schema.bookings.followUpSentAt)));
  for (const b of visited) {
    if (b.kind === 'adventure') await notifyFollowUp({ ref: b.ref, name: b.name, email: b.email, phone: b.phone, notifyWhatsapp: b.notifyWhatsapp });
    await db.update(schema.bookings).set({ followUpSentAt: new Date() }).where(eq(schema.bookings.id, b.id));
  }

  const vouchers = await deliverDueVouchers();
  return Response.json({ ok: true, expired, reminders: due.length, followUps: visited.length, vouchers });
}
