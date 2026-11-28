import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { getDb, schema } from '@/lib/db';
import { ticketFor } from '@/lib/data/bookings';
import { vapidKeys } from '@/lib/notify/channels';
import { rateLimit } from '@/lib/security';

/** GET → the VAPID public key; POST → save a subscription; DELETE → remove it. */
export async function GET() {
  const { publicKey } = await vapidKeys();
  return Response.json({ publicKey }, { headers: { 'Cache-Control': 'no-store' } });
}

const subSchema = z.object({
  subscription: z.object({
    endpoint: z.url().max(1000),
    keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
  }),
  topics: z.array(z.string().regex(/^(status|booking:ST-[A-Z0-9]{6})$/)).max(5),
  bookingRef: z.string().max(12).optional(),
  token: z.string().max(100).optional(),
});

export async function POST(request: Request) {
  if (!(await rateLimit('push', 10, 600))) return Response.json({ error: 'Too many requests' }, { status: 429 });
  const parsed = subSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Bad subscription' }, { status: 400 });
  const { subscription, topics, bookingRef, token } = parsed.data;
  // Only the ticket holder can subscribe to a booking's updates.
  const bookingTopics = topics.filter((t) => t.startsWith('booking:'));
  if (bookingTopics.length) {
    const ok = bookingRef && token && (await ticketFor(bookingRef, token));
    if (!ok || bookingTopics.some((t) => t !== `booking:${bookingRef}`)) return Response.json({ error: 'Not your booking' }, { status: 403 });
  }
  const db = await getDb();
  await db
    .insert(schema.pushSubscriptions)
    .values({ endpoint: subscription.endpoint, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth, topics, bookingRef: bookingRef ?? null })
    .onConflictDoUpdate({ target: schema.pushSubscriptions.endpoint, set: { topics, bookingRef: bookingRef ?? null } });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const body = (await request.json().catch(() => null)) as { endpoint?: string } | null;
  if (!body?.endpoint) return Response.json({ error: 'Missing endpoint' }, { status: 400 });
  const db = await getDb();
  await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.endpoint, body.endpoint));
  return Response.json({ ok: true });
}
