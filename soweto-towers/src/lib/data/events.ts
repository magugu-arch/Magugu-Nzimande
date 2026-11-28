import 'server-only';
import { and, asc, eq, gte } from 'drizzle-orm';
import { cacheLife, cacheTag } from 'next/cache';
import { getDb, schema } from '@/lib/db';

export type PublicEvent = {
  id: string;
  slug: string;
  title: string;
  tag: string;
  summary: string;
  body: string;
  startsAt: string;
  endsAt: string;
  image: string;
  price: number | null;
  capacity: number;
  status: 'draft' | 'published' | 'cancelled';
};

const toPublic = (e: typeof schema.events.$inferSelect): PublicEvent => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  tag: e.tag,
  summary: e.summary,
  body: e.body,
  startsAt: e.startsAt.toISOString(),
  endsAt: e.endsAt.toISOString(),
  image: e.image,
  price: e.price,
  capacity: e.capacity,
  status: e.status,
});

/** Published events that haven't finished, soonest first. Staff edits expire the "events" tag. */
export async function upcomingEvents(limit = 12): Promise<PublicEvent[]> {
  'use cache';
  cacheTag('events');
  cacheLife('hours');
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.events)
    .where(and(eq(schema.events.status, 'published'), gte(schema.events.endsAt, new Date())))
    .orderBy(asc(schema.events.startsAt))
    .limit(limit);
  return rows.map(toPublic);
}

export async function eventBySlug(slug: string): Promise<PublicEvent | null> {
  'use cache';
  cacheTag('events', `event:${slug}`);
  cacheLife('hours');
  const db = await getDb();
  const [e] = await db.select().from(schema.events).where(eq(schema.events.slug, slug));
  return e && e.status !== 'draft' ? toPublic(e) : null;
}

export async function allEventSlugs(): Promise<string[]> {
  'use cache';
  cacheTag('events');
  cacheLife('hours');
  const db = await getDb();
  const rows = await db.select({ slug: schema.events.slug, status: schema.events.status }).from(schema.events);
  return rows.filter((r) => r.status !== 'draft').map((r) => r.slug);
}
