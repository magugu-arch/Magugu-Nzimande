import 'server-only';
import type { Booking, Customer, EventRecord, NotificationChannel, Payment, Quote } from '@/lib/booking/types';
import { formatDayLong } from '@/lib/booking/dates';
import { formatZar } from '@/lib/booking/quote';
import { newId } from '@/lib/security/crypto';
import { getStore } from '@/lib/store';
import { emailAdapter, smsAdapter, whatsappAdapter } from './adapters';
import type { ChannelAdapter, NotificationEvent, OutboundMessage } from './types';

export { NOTIFICATION_EVENTS, type NotificationEvent } from './types';

export type NotifyContext = {
  booking: Booking;
  customer: Customer;
  event: EventRecord;
  portalUrl: string;
  quote?: Quote;
  payment?: Payment;
};

type Template = { subject: string; lines: string[]; params: string[] };

function template(e: NotificationEvent, c: NotifyContext): Template {
  const ref = c.booking.reference;
  const date = formatDayLong(c.event.date);
  const first = c.customer.fullName.split(/\s+/)[0] ?? c.customer.fullName;
  const link = `View your booking: ${c.portalUrl}`;
  switch (e) {
    case 'enquiry_received':
      return {
        subject: `Booking request received — ${ref}`,
        lines: [
          `Dear ${first},`,
          `Thank you for your request to book Zakes Bantwini for ${date}. Your reference is ${ref}.`,
          'The booking team reviews every request personally. You will hear from us with next steps, and your booking page shows the status at any time.',
          link,
        ],
        params: [first, ref, date],
      };
    case 'quote_ready':
      return {
        subject: `Your quote is ready — ${ref}`,
        lines: [
          `Dear ${first},`,
          `Your formal quotation for ${date} is ready${c.quote ? `: ${formatZar(c.quote.totalCents)} including a deposit of ${formatZar(c.quote.depositCents)}` : ''}.`,
          'Review the terms, then accept or request changes from your booking page.',
          link,
        ],
        params: [first, ref, c.quote ? formatZar(c.quote.totalCents) : ''],
      };
    case 'quote_accepted':
      return {
        subject: `Quote accepted — ${ref}`,
        lines: [`Dear ${first},`, `Thank you for accepting the quote for ${date}. The performance agreement follows next.`, link],
        params: [first, ref],
      };
    case 'contract_ready':
      return {
        subject: `Agreement ready to sign — ${ref}`,
        lines: [`Dear ${first},`, `The performance agreement for ${date} is ready for your signature.`, link],
        params: [first, ref],
      };
    case 'contract_signed':
      return {
        subject: `Agreement signed — ${ref}`,
        lines: [`Dear ${first},`, 'Thank you — the agreement is signed. The deposit secures your date.', link],
        params: [first, ref],
      };
    case 'deposit_requested':
      return {
        subject: `Secure your date — ${ref}`,
        lines: [
          `Dear ${first},`,
          `To secure ${date}, please pay the deposit${c.quote ? ` of ${formatZar(c.quote.depositCents)} by ${formatDayLong(c.quote.depositDueDate)}` : ''}.`,
          link,
        ],
        params: [first, ref, c.quote ? formatZar(c.quote.depositCents) : ''],
      };
    case 'deposit_received':
      return {
        subject: `Deposit received — ${ref}`,
        lines: [
          `Dear ${first},`,
          `We have received your deposit${c.payment ? ` of ${formatZar(c.payment.amountCents)}` : ''}. Management will confirm your booking shortly.`,
          link,
        ],
        params: [first, ref],
      };
    case 'balance_received':
      return {
        subject: `Balance received — ${ref}`,
        lines: [
          `Dear ${first},`,
          `We have received your balance payment${c.payment ? ` of ${formatZar(c.payment.amountCents)}` : ''}. Your booking is paid in full.`,
          link,
        ],
        params: [first, ref],
      };
    case 'payment_failed':
      return {
        subject: `Payment not completed — ${ref}`,
        lines: [`Dear ${first},`, 'Your payment did not go through and you have not been charged by us. You can try again from your booking page.', link],
        params: [first, ref],
      };
    case 'booking_confirmed':
      return {
        subject: `Booking confirmed — ${ref}`,
        lines: [`Dear ${first},`, `Your booking of Zakes Bantwini for ${date} is confirmed. The team will be in touch about production and logistics.`, link],
        params: [first, ref, date],
      };
    case 'balance_reminder':
      return {
        subject: `Balance due — ${ref}`,
        lines: [
          `Dear ${first},`,
          `A reminder that the balance${c.quote ? ` of ${formatZar(c.quote.balanceCents)}` : ''} for ${date} is due${c.quote?.balanceDueDate ? ` by ${formatDayLong(c.quote.balanceDueDate)}` : ''}.`,
          link,
        ],
        params: [first, ref],
      };
    case 'event_reminder':
      return {
        subject: `Your event is coming up — ${ref}`,
        lines: [`Dear ${first},`, `A reminder that your event with Zakes Bantwini is on ${date} at ${c.event.venue}, ${c.event.city}.`, link],
        params: [first, ref, date],
      };
  }
}

/** Events management also hears about, at BOOKINGS_INBOX_EMAIL. */
const MANAGEMENT_EVENTS: NotificationEvent[] = ['enquiry_received', 'quote_accepted', 'contract_signed', 'deposit_received', 'balance_received', 'payment_failed'];

function mask(recipient: string): string {
  if (recipient.includes('@')) {
    const [user = '', domain = ''] = recipient.split('@');
    return `${user.slice(0, 2)}***@${domain}`;
  }
  return `***${recipient.slice(-4)}`;
}

function html(lines: string[]): string {
  const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const body = lines
    .map((l) =>
      esc(l).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" style="color:#080808">$1</a>'),
    )
    .map((l) => `<p style="margin:0 0 16px">${l}</p>`)
    .join('');
  return `<div style="font-family:Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#121212;max-width:560px">
<p style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;margin:0 0 24px">Zakes Bantwini — Bookings</p>${body}</div>`;
}

async function deliver(adapter: ChannelAdapter, to: string, message: OutboundMessage, e: NotificationEvent, bookingId: string, audience: 'client' | 'management' = 'client') {
  const store = getStore();
  const base = { id: newId(), bookingId, event: e, channel: adapter.channel as NotificationChannel, audience, recipient: mask(to), createdAt: new Date().toISOString() };
  try {
    const result = await adapter.send(message, e);
    await store.insert('notifications', { ...base, status: result.status, provider: result.provider, providerId: result.providerId ?? null, error: null });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[notify] ${adapter.provider} ${e} failed: ${msg}`);
    await store.insert('notifications', { ...base, status: 'failed', provider: adapter.provider, providerId: null, error: msg.slice(0, 500) });
  }
}

/**
 * Announce a booking event on every channel the client allowed: email always,
 * SMS when a provider is configured, WhatsApp only with explicit opt-in.
 * Failures are recorded on the booking, never thrown — a provider outage must
 * not undo a quote acceptance or a payment.
 */
export async function notify(e: NotificationEvent, ctx: NotifyContext): Promise<void> {
  const t = template(e, ctx);
  const text = t.lines.join('\n\n');
  const message: OutboundMessage = { to: '', subject: t.subject, text, html: html(t.lines), templateParams: t.params };
  const jobs: Promise<void>[] = [deliver(emailAdapter(), ctx.customer.email, { ...message, to: ctx.customer.email }, e, ctx.booking.id)];

  const sms = smsAdapter();
  if (sms && ctx.customer.phone) jobs.push(deliver(sms, ctx.customer.phone, { ...message, to: ctx.customer.phone, text: `${t.subject}. ${t.lines.at(-1)}` }, e, ctx.booking.id));

  const wa = whatsappAdapter();
  if (wa && ctx.customer.whatsappOptIn && ctx.customer.phone) jobs.push(deliver(wa, ctx.customer.phone, { ...message, to: ctx.customer.phone }, e, ctx.booking.id));

  const inbox = process.env.BOOKINGS_INBOX_EMAIL;
  if (inbox && MANAGEMENT_EVENTS.includes(e)) {
    const lines = [`${t.subject}`, `Client: ${ctx.customer.fullName}${ctx.customer.organisation ? `, ${ctx.customer.organisation}` : ''}`, `Event date: ${formatDayLong(ctx.event.date)}`, `Open in admin: ${ctx.portalUrl.replace(/\/book\/confirmation\/.*/, `/admin/bookings/${ctx.booking.id}`)}`];
    jobs.push(deliver(emailAdapter(), inbox, { to: inbox, subject: `[Admin] ${t.subject}`, text: lines.join('\n'), html: html(lines) }, e, ctx.booking.id, 'management'));
  }

  await Promise.all(jobs);
}
