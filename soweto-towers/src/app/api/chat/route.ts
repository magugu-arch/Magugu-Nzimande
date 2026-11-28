import { and, asc, eq, gt, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { autoAnswer, topicAnswer } from '@/lib/chat-answers';
import { getDb, schema } from '@/lib/db';
import { secretToken } from '@/lib/ids';
import { notifyStaff } from '@/lib/notify';
import { rateLimit } from '@/lib/security';

const COOKIE = 'st_chat';

async function conversation() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const db = await getDb();
  const [c] = await db.select().from(schema.conversations).where(eq(schema.conversations.token, token));
  return c ?? null;
}

/** Messages after `after` (an id), and marks staff replies as read. */
export async function GET(request: Request) {
  const c = await conversation();
  if (!c) return Response.json({ messages: [], unread: 0 });
  const after = Number(new URL(request.url).searchParams.get('after') ?? 0) || 0;
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.messages.id,
      sender: schema.messages.sender,
      staffName: schema.messages.staffName,
      body: schema.messages.body,
      createdAt: schema.messages.createdAt,
    })
    .from(schema.messages)
    .where(and(eq(schema.messages.conversationId, c.id), gt(schema.messages.id, after)))
    .orderBy(asc(schema.messages.id))
    .limit(100);
  const peek = new URL(request.url).searchParams.get('peek') === '1';
  if (!peek && c.unreadForVisitor > 0) {
    await db.update(schema.conversations).set({ unreadForVisitor: 0 }).where(eq(schema.conversations.id, c.id));
  }
  return Response.json({ messages: rows, unread: c.unreadForVisitor });
}

const postSchema = z.object({
  body: z.string().trim().min(1).max(1000),
  topic: z.string().max(20).optional(),
  name: z.string().trim().max(60).optional(),
  contact: z.string().trim().max(80).optional(),
  page: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  if (!(await rateLimit('chat', 20, 300))) return Response.json({ error: 'Slow down a little and try again.' }, { status: 429 });
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Message can’t be empty.' }, { status: 400 });
  const { body, topic, name, contact, page } = parsed.data;
  const db = await getDb();
  let c = await conversation();
  const isNew = !c;
  if (!c) {
    const token = secretToken();
    const [created] = await db
      .insert(schema.conversations)
      .values({ token, name: name || null, contact: contact || null, page: page ?? null })
      .returning();
    if (!created) return Response.json({ error: 'We couldn’t start the chat. Please try again.' }, { status: 500 });
    c = created;
    (await cookies()).set(COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
  } else if (name || contact) {
    await db
      .update(schema.conversations)
      .set({ name: name || c.name, contact: contact || c.contact })
      .where(eq(schema.conversations.id, c.id));
  }

  await db.insert(schema.messages).values({ conversationId: c!.id, sender: 'visitor', body });
  const reply = (topic ? topicAnswer(topic) : null) ?? autoAnswer(body);
  const bot = reply
    ? `${reply}\n\nAnything else? A crew member can pick this up here too.`
    : isNew
      ? 'Thanks! A crew member will reply right here. Leave a WhatsApp number below if you might close this page.'
      : null;
  if (bot) await db.insert(schema.messages).values({ conversationId: c!.id, sender: 'bot', body: bot });
  await db
    .update(schema.conversations)
    .set({
      status: 'open',
      lastMessageAt: new Date(),
      unreadForStaff: sql`${schema.conversations.unreadForStaff} + 1`,
    })
    .where(eq(schema.conversations.id, c!.id));

  if (isNew && !reply) {
    await notifyStaff('New chat on the website', [`“${body.slice(0, 300)}”`, page ? `Page: ${page}` : ''].filter(Boolean), '/admin/inbox');
  }
  return Response.json({ ok: true });
}
