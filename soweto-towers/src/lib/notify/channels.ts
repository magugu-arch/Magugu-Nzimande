import 'server-only';
import { eq } from 'drizzle-orm';
import { site } from '@/content/site';
import { getDb, schema } from '@/lib/db';

/**
 * Three delivery channels. Each sends for real when its keys are set and
 * otherwise records a "simulated" send, so previews show exactly what a
 * customer would receive (Console → Outbox) without contacting anyone.
 */

type Log = {
  channel: 'email' | 'whatsapp' | 'push';
  to: string;
  template: string;
  subject?: string;
  body: string;
  bookingRef?: string | null;
};

async function log(entry: Log, status: 'sent' | 'simulated' | 'failed', error?: string) {
  try {
    const db = await getDb();
    await db.insert(schema.notifications).values({
      channel: entry.channel,
      to: entry.to,
      template: entry.template,
      subject: entry.subject ?? null,
      body: entry.body.slice(0, 4000),
      status,
      error: error?.slice(0, 500) ?? null,
      bookingRef: entry.bookingRef ?? null,
    });
  } catch (err) {
    console.error('notification log failed', err);
  }
}

// ---------- Email (Resend HTTP API) ----------

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  template: string;
  bookingRef?: string | null;
  replyTo?: string;
}): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const entry: Log = { channel: 'email', to: opts.to, template: opts.template, subject: opts.subject, body: opts.text, bookingRef: opts.bookingRef };
  if (!key) return log(entry, 'simulated');
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? `Soweto Towers <bookings@${new URL(site.url).hostname}>`,
        to: [opts.to],
        subject: opts.subject,
        html: opts.html,
        text: opts.text,
        reply_to: opts.replyTo ?? site.email,
      }),
    });
    if (!res.ok) return log(entry, 'failed', `${res.status} ${await res.text()}`);
    return log(entry, 'sent');
  } catch (err) {
    return log(entry, 'failed', (err as Error).message);
  }
}

// ---------- WhatsApp (Meta Cloud API) ----------

/** E.164 digits for South African numbers typed as 082 123 4567 or +27 82 123 4567. */
export function toWhatsAppDigits(phone: string): string | null {
  let d = phone.replace(/[^\d]/g, '');
  if (d.startsWith('0') && d.length === 10) d = `27${d.slice(1)}`;
  return d.length >= 10 && d.length <= 15 ? d : null;
}

/**
 * Business-initiated WhatsApp messages must use a template approved in Meta
 * Business Manager. Template names and parameters are listed in README →
 * WhatsApp templates. `preview` is the rendered text for the outbox log.
 */
export async function sendWhatsAppTemplate(opts: {
  to: string;
  template: string;
  params: string[];
  preview: string;
  bookingRef?: string | null;
  buttonUrlSuffix?: string;
}): Promise<void> {
  const digits = toWhatsAppDigits(opts.to);
  const entry: Log = { channel: 'whatsapp', to: opts.to, template: opts.template, body: opts.preview, bookingRef: opts.bookingRef };
  if (!digits) return log(entry, 'failed', 'invalid number');
  const token = process.env.WHATSAPP_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneId) return log(entry, 'simulated');
  try {
    const components: object[] = [{ type: 'body', parameters: opts.params.map((text) => ({ type: 'text', text })) }];
    if (opts.buttonUrlSuffix) {
      components.push({ type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: opts.buttonUrlSuffix }] });
    }
    const res = await fetch(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION ?? 'v23.0'}/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: digits,
        type: 'template',
        template: { name: opts.template, language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? 'en' }, components },
      }),
    });
    if (!res.ok) return log(entry, 'failed', `${res.status} ${await res.text()}`);
    return log(entry, 'sent');
  } catch (err) {
    return log(entry, 'failed', (err as Error).message);
  }
}

// ---------- Web push (VAPID) ----------

type Vapid = { publicKey: string; privateKey: string };

/** web-push is CommonJS; bundlers expose it either as the namespace or as `default`. */
async function loadWebPush(): Promise<typeof import('web-push')> {
  const mod = (await import('web-push')) as typeof import('web-push') & { default?: typeof import('web-push') };
  return mod.default ?? mod;
}

/** VAPID keys from env; previews generate a pair once and keep it in settings. */
export async function vapidKeys(): Promise<Vapid> {
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (pub && priv) return { publicKey: pub, privateKey: priv };
  const db = await getDb();
  const rows = await db.select().from(schema.settings).where(eq(schema.settings.key, 'vapid'));
  const stored = rows[0]?.value as Vapid | undefined;
  if (stored?.publicKey) return stored;
  const webpush = await loadWebPush();
  const keys = webpush.generateVAPIDKeys();
  await db.insert(schema.settings).values({ key: 'vapid', value: keys }).onConflictDoNothing();
  return keys;
}

export type PushPayload = { title: string; body: string; url: string; tag?: string };

export async function sendPushToTopic(topic: string, payload: PushPayload, template: string): Promise<number> {
  const db = await getDb();
  const subs = await db.select().from(schema.pushSubscriptions);
  const targets = subs.filter((s) => s.topics.includes(topic));
  if (targets.length === 0) return 0;
  const keys = await vapidKeys();
  const webpush = await loadWebPush();
  webpush.setVapidDetails(`mailto:${site.email}`, keys.publicKey, keys.privateKey);
  let delivered = 0;
  await Promise.all(
    targets.map(async (s) => {
      const entry: Log = { channel: 'push', to: new URL(s.endpoint).host, template, body: `${payload.title}: ${payload.body}`, bookingRef: s.bookingRef };
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ ...payload, icon: '/icons/icon-192.png', badge: '/icons/badge-96.png' }),
          { TTL: 60 * 60 * 6 },
        );
        delivered++;
        await log(entry, 'sent');
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.id, s.id));
        }
        await log(entry, 'failed', `${status ?? ''} ${(err as Error).message}`);
      }
    }),
  );
  return delivered;
}

export async function staffInbox(): Promise<string> {
  return process.env.STAFF_NOTIFY_EMAIL ?? site.email;
}
