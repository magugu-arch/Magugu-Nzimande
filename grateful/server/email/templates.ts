import { site } from '../../src/data/site';
import { formatDuration, formatLongDate, formatRand } from '../../shared/format';
import type { EmailMessage } from './types';

/**
 * Transactional email templates, in the same black-and-white, Baskerville-led
 * voice as the site. Table layout and inline styles because that is what
 * email clients render reliably. Every value is escaped: names and notes
 * are typed by the public.
 */

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const serif = "Baskerville, 'Baskervville', 'Libre Baskerville', Georgia, 'Times New Roman', serif";
const sans = "'Avenir Next', Avenir, 'Helvetica Neue', Arial, sans-serif";

type Row = [label: string, value: string];

function layout(opts: { siteUrl: string; preheader: string; heading: string; intro: string; rows?: Row[]; body?: string; cta?: { href: string; label: string } }) {
  const rows = (opts.rows ?? [])
    .map(
      ([k, v]) => `<tr>
  <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font:11px/1.4 ${sans};letter-spacing:.16em;text-transform:uppercase;color:#6b6b6b;width:38%;vertical-align:top">${esc(k)}</td>
  <td style="padding:10px 0;border-bottom:1px solid #e5e5e5;font:16px/1.5 ${serif};color:#000">${esc(v)}</td>
</tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#ffffff">
<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px">
  <tr><td style="background:#000;padding:28px 32px;text-align:left">
    <span style="font:36px/1 ${serif};color:#fff">g</span>
    <span style="display:inline-block;width:1px;height:30px;background:#fff;margin:0 16px;vertical-align:-4px"></span>
    <span style="font:14px/1 ${serif};letter-spacing:.5em;color:#fff">GRATEFUL</span>
  </td></tr>
  <tr><td style="padding:40px 32px 8px">
    <h1 style="margin:0 0 16px;font:400 30px/1.1 ${serif};letter-spacing:-.01em;color:#000;text-transform:uppercase">${esc(opts.heading)}</h1>
    <p style="margin:0 0 24px;font:17px/1.6 ${serif};color:#222">${esc(opts.intro)}</p>
    ${rows ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px">${rows}</table>` : ''}
    ${opts.body ?? ''}
    ${
      opts.cta
        ? `<p style="margin:8px 0 32px"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:14px 26px;font:12px/1 ${sans};letter-spacing:.18em;text-transform:uppercase">${esc(opts.cta.label)}</a></p>`
        : ''
    }
  </td></tr>
  <tr><td style="padding:24px 32px 40px;border-top:1px solid #000">
    <p style="margin:0;font:15px/1.6 ${serif};color:#000"><strong>${esc(site.studioName)}</strong><br><em>${esc(site.studioLine)}</em></p>
    <p style="margin:12px 0 0;font:13px/1.7 ${sans};color:#444">E. <a href="mailto:${site.email}" style="color:#000">${esc(site.email)}</a><br>${esc(site.location)}<br><a href="${esc(opts.siteUrl)}" style="color:#000">${esc(opts.siteUrl.replace(/^https?:\/\//, ''))}</a></p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

function text(heading: string, intro: string, rows: Row[] = [], extra = '') {
  return [
    heading.toUpperCase(),
    '',
    intro,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    extra ? `\n${extra}` : '',
    '',
    '—',
    site.studioName,
    site.studioLine,
    `E. ${site.email}`,
    site.location,
  ].join('\n');
}

export type BookingEmailData = {
  bookingId: string;
  clientName: string;
  email: string;
  phone: string;
  serviceName: string;
  durationMinutes: number;
  date: string;
  time: string;
  notes: string;
  paymentLabel: string;
  amountPaidCents?: number | null;
};

const bookingRows = (b: BookingEmailData): Row[] => [
  ['Service', b.serviceName],
  ['Date', formatLongDate(b.date)],
  ['Time', `${b.time} (SAST)`],
  ['Duration', formatDuration(b.durationMinutes)],
  ['Payment', b.paymentLabel],
];

const nextSteps = `We look forward to meeting you. If you need to reschedule or cancel, reply to this email at least 48 hours before your appointment.`;

export function bookingConfirmedClient(siteUrl: string, b: BookingEmailData): EmailMessage {
  const heading = 'Your Grateful journey begins';
  const intro = `Thank you, ${b.clientName.split(' ')[0]}. Your appointment is confirmed.`;
  const rows = bookingRows(b);
  return {
    to: b.email,
    replyTo: site.email,
    subject: `Confirmed: ${b.serviceName} on ${formatLongDate(b.date)}`,
    html: layout({
      siteUrl,
      preheader: `${formatLongDate(b.date)} at ${b.time}`,
      heading,
      intro,
      rows,
      body: `<p style="margin:0 0 24px;font:16px/1.6 ${serif};color:#222">${esc(nextSteps)}</p>`,
      cta: { href: `${siteUrl}/confirmation?booking=${b.bookingId}`, label: 'View booking' },
    }),
    text: text(heading, intro, rows, `${nextSteps}\n\nView your booking: ${siteUrl}/confirmation?booking=${b.bookingId}`),
  };
}

export function paymentReceiptClient(siteUrl: string, b: BookingEmailData, reference: string): EmailMessage {
  const heading = 'Payment received';
  const intro = `Thank you, ${b.clientName.split(' ')[0]}. We have received your payment of ${formatRand(b.amountPaidCents ?? 0)}.`;
  const rows: Row[] = [
    ['Amount', formatRand(b.amountPaidCents ?? 0)],
    ['For', b.serviceName],
    ['Appointment', `${formatLongDate(b.date)}, ${b.time}`],
    ['Reference', reference],
  ];
  return {
    to: b.email,
    replyTo: site.email,
    subject: `Receipt: ${formatRand(b.amountPaidCents ?? 0)} — ${b.serviceName}`,
    html: layout({ siteUrl, preheader: 'Your payment receipt from Grateful', heading, intro, rows }),
    text: text(heading, intro, rows),
  };
}

export function bookingNotificationStudio(siteUrl: string, b: BookingEmailData, studioEmail: string): EmailMessage {
  const heading = 'New booking';
  const intro = `${b.clientName} has booked ${b.serviceName}.`;
  const rows: Row[] = [...bookingRows(b), ['Client', b.clientName], ['Email', b.email], ['Phone', b.phone], ['Notes', b.notes || '—'], ['Booking ID', b.bookingId]];
  return {
    to: studioEmail,
    replyTo: b.email,
    subject: `New booking: ${b.serviceName} — ${formatLongDate(b.date)} ${b.time}`,
    html: layout({ siteUrl, preheader: `${b.clientName}, ${formatLongDate(b.date)} ${b.time}`, heading, intro, rows }),
    text: text(heading, intro, rows),
  };
}

export function paymentConflictStudio(siteUrl: string, b: BookingEmailData, studioEmail: string, reference: string): EmailMessage {
  const heading = 'Action needed: paid booking clash';
  const intro = `${b.clientName} paid after their hold expired and the slot had been taken. Contact them to rebook or refund.`;
  const rows: Row[] = [...bookingRows(b), ['Client', b.clientName], ['Email', b.email], ['Phone', b.phone], ['Payment ref', reference], ['Booking ID', b.bookingId]];
  return {
    to: studioEmail,
    subject: `ACTION NEEDED: payment for an unavailable slot — ${b.clientName}`,
    html: layout({ siteUrl, preheader: 'A payment needs your attention', heading, intro, rows }),
    text: text(heading, intro, rows),
  };
}

export function paymentConflictClient(siteUrl: string, b: BookingEmailData): EmailMessage {
  const heading = 'About your booking';
  const intro = `Thank you, ${b.clientName.split(' ')[0]}. Your payment was received, but the time you chose was taken while checkout was open. We will contact you shortly to find a new time or refund you in full.`;
  const rows = bookingRows(b);
  return {
    to: b.email,
    replyTo: site.email,
    subject: 'About your Grateful booking',
    html: layout({ siteUrl, preheader: 'We will be in touch to rebook', heading, intro, rows }),
    text: text(heading, intro, rows),
  };
}

export function bookingCancelledClient(siteUrl: string, b: BookingEmailData, reason: 'cancelled' | 'rescheduled'): EmailMessage {
  const heading = reason === 'cancelled' ? 'Your booking is cancelled' : 'Your booking has moved';
  const intro =
    reason === 'cancelled'
      ? `Your ${b.serviceName} appointment on ${formatLongDate(b.date)} has been cancelled.`
      : `Your ${b.serviceName} appointment has been rescheduled. The new details are below.`;
  const rows = bookingRows(b);
  const body = `If this is unexpected, reply to this email.`;
  return {
    to: b.email,
    replyTo: site.email,
    subject: reason === 'cancelled' ? `Cancelled: ${b.serviceName}` : `Rescheduled: ${b.serviceName}`,
    html: layout({
      siteUrl,
      preheader: heading,
      heading,
      intro,
      rows,
      body: `<p style="margin:0 0 24px;font:16px/1.6 ${serif};color:#222">${esc(body)}</p>`,
      cta: { href: `${siteUrl}/booking`, label: 'Book again' },
    }),
    text: text(heading, intro, rows, body),
  };
}

export function contactNotificationStudio(
  siteUrl: string,
  m: { name: string; email: string; phone: string; subject: string; message: string },
  studioEmail: string,
): EmailMessage {
  const heading = 'New enquiry';
  const intro = `${m.name} sent a message through the website.`;
  const rows: Row[] = [
    ['Name', m.name],
    ['Email', m.email],
    ['Phone', m.phone || '—'],
    ['Interest', m.subject || '—'],
  ];
  return {
    to: studioEmail,
    replyTo: m.email,
    subject: `Enquiry from ${m.name}${m.subject ? ` — ${m.subject}` : ''}`,
    html: layout({
      siteUrl,
      preheader: m.message.slice(0, 90),
      heading,
      intro,
      rows,
      body: `<p style="margin:0 0 24px;font:16px/1.6 ${serif};color:#222;white-space:pre-wrap">${esc(m.message)}</p>`,
    }),
    text: text(heading, intro, rows, m.message),
  };
}

export function newsletterWelcome(siteUrl: string, email: string, unsubscribeHref: string): EmailMessage {
  const heading = 'Welcome to Grateful';
  const intro = 'Thank you for joining us. We will write when there is something worth sharing — new work, new pieces, and openings in the studio diary.';
  return {
    to: email,
    replyTo: site.email,
    subject: 'Welcome to Grateful',
    html: layout({
      siteUrl,
      preheader: 'Be bold. Be you. Be different.',
      heading,
      intro,
      cta: { href: `${siteUrl}/work`, label: 'Explore the work' },
      body: `<p style="margin:0 0 8px;font:12px/1.6 ${sans};color:#6b6b6b">You can <a href="${esc(unsubscribeHref)}" style="color:#6b6b6b">unsubscribe</a> at any time.</p>`,
    }),
    text: text(heading, intro, [], `Explore the work: ${siteUrl}/work\n\nUnsubscribe: ${unsubscribeHref}`),
  };
}

export function appointmentReminderClient(siteUrl: string, b: BookingEmailData): EmailMessage {
  const heading = 'See you tomorrow';
  const intro = `A reminder, ${b.clientName.split(' ')[0]}: your appointment with Grateful is tomorrow.`;
  const rows = bookingRows(b);
  const body = `Bring any inspiration you love: images, fabrics, or a garment you want to reference. If you need to change the time, reply to this email.`;
  return {
    to: b.email,
    replyTo: site.email,
    subject: `Tomorrow at ${b.time}: ${b.serviceName}`,
    html: layout({
      siteUrl,
      preheader: `${formatLongDate(b.date)} at ${b.time}`,
      heading,
      intro,
      rows,
      body: `<p style="margin:0 0 24px;font:16px/1.6 ${serif};color:#222">${esc(body)}</p>`,
      cta: { href: `${siteUrl}/confirmation?booking=${b.bookingId}`, label: 'View booking' },
    }),
    text: text(heading, intro, rows, body),
  };
}
