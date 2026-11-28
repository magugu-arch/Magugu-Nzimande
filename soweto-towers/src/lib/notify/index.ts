import 'server-only';
import { absoluteUrl, site, whatsappLink } from '@/content/site';
import { rand } from '@/lib/format';
import { formatDayLong } from '@/lib/time';
import { sendEmail, sendPushToTopic, sendWhatsAppTemplate, staffInbox } from './channels';

/**
 * Every message the towers send, in one place: booking confirmation, the day-
 * before reminder, weather holds, the Scream Clip, the review ask, vouchers and
 * staff alerts. WhatsApp template names match README → WhatsApp templates.
 */

const BRAND = '#E3501C';

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function emailLayout({
  preheader,
  heading,
  paragraphs,
  cta,
  footnote,
}: {
  preheader: string;
  heading: string;
  paragraphs: string[];
  cta?: { label: string; url: string };
  footnote?: string;
}): { html: string; text: string } {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:16px;line-height:1.5;color:#1E2020">${esc(p)}</p>`).join('');
  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.url}" style="display:inline-block;background:${BRAND};color:#121212;text-decoration:none;font-weight:700;letter-spacing:.08em;text-transform:uppercase;font-size:14px;padding:14px 22px;border-radius:999px">${esc(cta.label)}</a></p>`
    : '';
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(heading)}</title></head>
<body style="margin:0;background:#E2E3DE;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#F9F9F7;border-radius:24px;padding:32px">
<tr><td>
<p style="margin:0 0 6px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#A23E18;font-weight:700">Soweto Towers · From the top</p>
<h1 style="margin:0 0 18px;font-size:28px;line-height:1.1;text-transform:uppercase;font-weight:400;color:#1E2020">${esc(heading)}</h1>
${body}${button}
${footnote ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.5;color:#5B5D5C">${esc(footnote)}</p>` : ''}
</td></tr></table>
<p style="font-size:12px;color:#5B5D5C;margin:16px 0 0">${esc(site.address.street)}, ${esc(site.address.suburb)}, ${esc(site.address.city)} · ${esc(site.phone.display)}</p>
</td></tr></table></body></html>`;
  const text = [heading.toUpperCase(), '', ...paragraphs, cta ? `\n${cta.label}: ${cta.url}` : '', footnote ? `\n${footnote}` : ''].join('\n').trim();
  return { html, text };
}

export type ConfirmedBooking = {
  id: string;
  ref: string;
  kind: 'adventure' | 'voucher' | 'event';
  name: string;
  email: string;
  phone: string;
  notifyWhatsapp: boolean;
  visitDate: string | null;
  total: number;
  ticketToken: string;
  summary: string;
  firstTime: string | null;
};

export async function notifyBookingConfirmed(b: ConfirmedBooking): Promise<void> {
  const ticketUrl = absoluteUrl(`/ticket/${b.ref}?t=${b.ticketToken}`);
  const when = b.visitDate ? `${formatDayLong(b.visitDate)}${b.firstTime ? ` at ${b.firstTime}` : ''}` : '';
  const firstName = b.name.split(' ')[0] ?? b.name;

  if (b.kind === 'voucher') {
    const { html, text } = emailLayout({
      preheader: `Payment received for ${b.ref}`,
      heading: 'Your Gift a Jump is paid',
      paragraphs: [
        `Thanks ${firstName}. We have received ${rand(b.total)} for ${b.summary}.`,
        'Your voucher is on its way to the person you chose, on the day you chose. You can also open and print it from the link below.',
      ],
      cta: { label: 'View voucher', url: absoluteUrl(`/booking/${b.id}/return`) },
    });
    await sendEmail({ to: b.email, subject: `Gift a Jump · ${b.ref}`, html, text, template: 'voucher_paid', bookingRef: b.ref });
    return;
  }

  const { html, text } = emailLayout({
    preheader: `${b.ref} · ${when}`,
    heading: b.kind === 'event' ? 'You’re on the list' : 'Your jump is booked',
    paragraphs: [
      `Sawubona ${firstName}! ${b.summary}${when ? `, ${when}` : ''}.`,
      `Booking reference ${b.ref}. Show the QR code on your ticket at the gate: it works offline once you’ve opened it.`,
      b.kind === 'adventure'
        ? 'Arrive 20 minutes before your slot, wear closed shoes and bring sunscreen. If rain or lightning stops jumps, you can move your slot for free.'
        : 'See you at the towers.',
    ],
    cta: { label: 'Open your ticket', url: ticketUrl },
    footnote: `Questions? WhatsApp us on ${site.whatsapp.display} or reply to this email. Entrance is R${site.entranceFee} per person at the gate, card only.`,
  });
  await sendEmail({ to: b.email, subject: `Booked: ${b.summary} · ${b.ref}`, html, text, template: 'booking_confirmed', bookingRef: b.ref });

  if (b.notifyWhatsapp) {
    await sendWhatsAppTemplate({
      to: b.phone,
      template: 'booking_confirmed',
      params: [firstName, b.summary, when || 'your visit', b.ref],
      preview: `Sawubona ${firstName}! ${b.summary} is booked for ${when || 'your visit'}. Ref ${b.ref}. Your ticket: ${ticketUrl}`,
      bookingRef: b.ref,
      buttonUrlSuffix: `${b.ref}?t=${b.ticketToken}`,
    });
  }
  await sendPushToTopic(
    `booking:${b.ref}`,
    { title: 'Booking confirmed', body: `${b.summary} · ${when}`, url: `/ticket/${b.ref}?t=${b.ticketToken}`, tag: b.ref },
    'booking_confirmed',
  );
}

export async function notifyReminder(b: {
  ref: string;
  name: string;
  email: string;
  phone: string;
  notifyWhatsapp: boolean;
  firstTime: string | null;
  ticketToken: string;
  summary: string;
}) {
  const ticketUrl = absoluteUrl(`/ticket/${b.ref}?t=${b.ticketToken}`);
  const firstName = b.name.split(' ')[0] ?? b.name;
  const line = `Tomorrow ${b.firstTime ? `at ${b.firstTime}` : ''}: ${b.summary}. Arrive 20 minutes early, wear closed shoes. Tower status updates live on the site.`;
  if (b.notifyWhatsapp) {
    await sendWhatsAppTemplate({
      to: b.phone,
      template: 'visit_reminder',
      params: [firstName, b.firstTime ?? '', b.summary],
      preview: `Hi ${firstName}! ${line} ${ticketUrl}`,
      bookingRef: b.ref,
      buttonUrlSuffix: `${b.ref}?t=${b.ticketToken}`,
    });
  }
  const { html, text } = emailLayout({ preheader: line, heading: 'See you tomorrow', paragraphs: [line], cta: { label: 'Open your ticket', url: ticketUrl } });
  await sendEmail({ to: b.email, subject: `Tomorrow at the towers · ${b.ref}`, html, text, template: 'visit_reminder', bookingRef: b.ref });
  await sendPushToTopic(`booking:${b.ref}`, { title: 'See you tomorrow', body: line, url: `/ticket/${b.ref}?t=${b.ticketToken}` }, 'visit_reminder');
}

export async function notifyFollowUp(b: { ref: string; name: string; email: string; phone: string; notifyWhatsapp: boolean }) {
  const firstName = b.name.split(' ')[0] ?? b.name;
  const reviewUrl = process.env.NEXT_PUBLIC_GOOGLE_REVIEW_URL || absoluteUrl('/contact');
  const clipUrl = absoluteUrl(`/find-my-jump?ref=${encodeURIComponent(b.ref)}`);
  if (b.notifyWhatsapp) {
    await sendWhatsAppTemplate({
      to: b.phone,
      template: 'after_visit',
      params: [firstName],
      preview: `Welcome to the #100mClub, ${firstName}! Your clip lives here: ${clipUrl}. Got 30 seconds for a Google review? ${reviewUrl}`,
      bookingRef: b.ref,
    });
  }
  const { html, text } = emailLayout({
    preheader: 'Welcome to the #100mClub',
    heading: 'Welcome to the #100mClub',
    paragraphs: [
      `You did it, ${firstName}. Your Scream Clip and any videos you bought are on Find my jump.`,
      'If you have 30 seconds, a Google review helps the next nervous first-timer take the step.',
    ],
    cta: { label: 'Leave a review', url: reviewUrl },
    footnote: `Find my jump: ${clipUrl}`,
  });
  await sendEmail({ to: b.email, subject: 'Welcome to the #100mClub', html, text, template: 'after_visit', bookingRef: b.ref });
}

export async function notifyClipReady(b: { ref: string; name: string; phone: string; email: string }) {
  const firstName = b.name.split(' ')[0] ?? b.name;
  const url = absoluteUrl(`/find-my-jump?ref=${encodeURIComponent(b.ref)}`);
  await sendWhatsAppTemplate({
    to: b.phone,
    template: 'scream_clip_ready',
    params: [firstName],
    preview: `${firstName}, your Scream Clip is ready! Watch and share it with #100mClub: ${url}`,
    bookingRef: b.ref,
  });
  const { html, text } = emailLayout({
    preheader: 'Your Scream Clip is ready',
    heading: 'Your Scream Clip is ready',
    paragraphs: ['Watch it, download it and share it with #100mClub. Want the whole jump? The full HD edit is one tap away.'],
    cta: { label: 'Watch your clip', url },
  });
  await sendEmail({ to: b.email, subject: 'Your Scream Clip is ready', html, text, template: 'scream_clip_ready', bookingRef: b.ref });
}

export async function notifyTowerStatus(
  state: 'hold' | 'closed' | 'open',
  note: string | null,
  todaysBookings: { ref: string; name: string; phone: string; notifyWhatsapp: boolean; ticketToken: string }[],
) {
  const title = state === 'hold' ? 'Weather hold at the towers' : state === 'closed' ? 'Towers closed today' : 'We’re jumping again';
  const body =
    note ||
    (state === 'hold'
      ? 'Jumps are paused while the weather passes. Your slot is safe; we’ll update you here.'
      : state === 'closed'
        ? 'The towers are closed for the rest of today. Move your booking for free from your ticket.'
        : 'The weather has cleared and the crew is back on the bridge.');
  await sendPushToTopic('status', { title, body, url: '/visit#status', tag: 'tower-status' }, `status_${state}`);
  for (const b of todaysBookings) {
    if (!b.notifyWhatsapp) continue;
    const first = b.name.split(' ')[0] ?? b.name;
    await sendWhatsAppTemplate({
      to: b.phone,
      template: `tower_${state}`,
      params: [first, body],
      preview: `${first}: ${title}. ${body} Ticket: ${absoluteUrl(`/ticket/${b.ref}?t=${b.ticketToken}`)}`,
      bookingRef: b.ref,
    });
    await sendPushToTopic(`booking:${b.ref}`, { title, body, url: `/ticket/${b.ref}?t=${b.ticketToken}` }, `status_${state}`);
  }
}

export async function notifyVoucher(v: {
  code: string;
  token: string;
  label: string;
  recipientName: string;
  recipientEmail: string | null;
  recipientPhone: string | null;
  purchaserName: string;
  purchaserEmail: string;
  message: string | null;
  delivery: 'email' | 'whatsapp' | 'me';
  expiresAt: Date;
}) {
  const url = absoluteUrl(`/voucher/${v.code}?t=${v.token}`);
  const from = v.purchaserName.split(' ')[0] ?? v.purchaserName;
  const lines = [
    `${from} has given you ${v.label} at Soweto Towers.`,
    v.message ? `“${v.message}”` : '',
    `Use code ${v.code} when you book a timed slot. Valid until ${v.expiresAt.toISOString().slice(0, 10)}.`,
  ].filter(Boolean);
  if (v.delivery === 'whatsapp' && v.recipientPhone) {
    await sendWhatsAppTemplate({
      to: v.recipientPhone,
      template: 'gift_a_jump',
      params: [v.recipientName.split(' ')[0] ?? v.recipientName, from, v.label, v.code],
      preview: `${v.recipientName}, ${lines.join(' ')} ${url}`,
      buttonUrlSuffix: `${v.code}?t=${v.token}`,
    });
    return;
  }
  const to = v.delivery === 'email' && v.recipientEmail ? v.recipientEmail : v.purchaserEmail;
  const { html, text } = emailLayout({
    preheader: `${from} sent you a Gift a Jump`,
    heading: v.delivery === 'me' ? 'Your Gift a Jump voucher' : `A jump, from ${from}`,
    paragraphs: lines,
    cta: { label: 'Open the voucher', url },
    footnote: 'Book at sowetotowers.co.za/book and enter the code at checkout.',
  });
  await sendEmail({
    to,
    subject: v.delivery === 'me' ? `Gift a Jump voucher ${v.code}` : `${from} sent you a Gift a Jump`,
    html,
    text,
    template: 'gift_a_jump',
  });
}

export async function notifyStaff(subject: string, lines: string[], link?: string) {
  const { html, text } = emailLayout({
    preheader: subject,
    heading: subject,
    paragraphs: lines,
    cta: link ? { label: 'Open in console', url: absoluteUrl(link) } : undefined,
  });
  await sendEmail({ to: await staffInbox(), subject: `[Soweto Towers] ${subject}`, html, text, template: 'staff_alert' });
}

export const whatsappHelpLink = (ref?: string) => whatsappLink(ref ? `Hi Soweto Towers, it’s about booking ${ref}: ` : 'Hi Soweto Towers! ');
