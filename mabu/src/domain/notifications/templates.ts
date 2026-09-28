import { DomainError } from '../shared/errors';
import type { NotificationChannel, NotificationTemplate, RenderedMessage } from './types';

/**
 * §42: "Do not leak sensitive guest information into notification previews."
 * Push, SMS and WhatsApp bodies show on a lock screen, so their templates may
 * only use these variables. No names, references, codes, emails, phone
 * numbers or payment details. Email and in-app are behind the guest's own
 * login and may use anything in the message data.
 */
export const PREVIEW_SAFE_VARIABLES = new Set([
  'date',
  'time',
  'partySize',
  'points',
  'tierName',
  'eventTitle',
  'rewardName',
  'amount',
  'daysLeft',
  'headline',
]);

const PREVIEW_CHANNELS: NotificationChannel[] = ['push', 'sms', 'whatsapp'];

export function variablesIn(text: string): string[] {
  return [...text.matchAll(/\{\{\s*(\w+)\s*\}\}/g)].map((m) => m[1]!);
}

export function assertTemplateSafe(
  template: Pick<NotificationTemplate, 'channel' | 'body' | 'subject'>,
): void {
  if (!PREVIEW_CHANNELS.includes(template.channel)) return;
  const unsafe = variablesIn(`${template.subject ?? ''} ${template.body}`).filter(
    (v) => !PREVIEW_SAFE_VARIABLES.has(v),
  );
  if (unsafe.length) {
    throw new DomainError(
      'VALIDATION',
      `A ${template.channel} message is visible on a lock screen and cannot include: ${unsafe.join(', ')}.`,
      'unsafe template variable',
    );
  }
}

export function render(
  template: Pick<NotificationTemplate, 'subject' | 'body' | 'version' | 'channel'>,
  data: Record<string, unknown>,
): RenderedMessage {
  const fill = (text: string) =>
    text.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => {
      if (PREVIEW_CHANNELS.includes(template.channel) && !PREVIEW_SAFE_VARIABLES.has(key))
        return '';
      const value = data[key];
      return value === undefined || value === null ? '' : String(value);
    });
  return {
    subject: fill(template.subject ?? ''),
    body: fill(template.body)
      .replace(/\s{2,}/g, ' ')
      .trim(),
    templateVersion: template.version,
  };
}

type Seed = { key: string; subject: string; push: string; email?: string };

/**
 * Default copy, in the brief's hospitality voice (§26). Each key gets an
 * `in-app` template (also used for push when no push template exists) and an
 * `email` template. All are versioned and editable in Admin → Templates.
 */
const SEEDS: Seed[] = [
  {
    key: 'booking.confirmed',
    subject: 'Your table at Mábu is reserved.',
    push: 'Your table for {{partySize}} on {{date}} at {{time}} is reserved. We look forward to welcoming you.',
    email:
      'Dear {{guestName}},\n\nYour table at Mábu is reserved.\n\nReference: {{reference}}\nWhen: {{date}} at {{time}}\nGuests: {{partySize}}\nWhere: Mábu Restaurant, Waterfall Wilds, Midrand\n\n{{policy}}\n\nYou can view, amend or cancel your booking in the Mábu app.\n\nWarm regards,\nThe Mábu team',
  },
  {
    key: 'booking.requested',
    subject: 'Your booking request is held',
    push: 'Your table for {{partySize}} on {{date}} at {{time}} is held — complete the deposit to confirm.',
  },
  {
    key: 'booking.reminder',
    subject: 'We look forward to seeing you',
    push: 'A reminder of your table for {{partySize}} on {{date}} at {{time}}. Tables are held for 15 minutes.',
    email:
      'Dear {{guestName}},\n\nA gentle reminder of your table at Mábu on {{date}} at {{time}} for {{partySize}} (reference {{reference}}).\n\nIf your plans have changed, you can amend or cancel in the app.\n\nThe Mábu team',
  },
  {
    key: 'booking.rescheduled',
    subject: 'Your booking has moved',
    push: 'Your table is now on {{date}} at {{time}} for {{partySize}}.',
  },
  {
    key: 'booking.amended',
    subject: 'Your booking details are updated',
    push: 'We have updated the details of your booking on {{date}} at {{time}}.',
  },
  {
    key: 'booking.cancelled',
    subject: 'Your booking is cancelled',
    push: 'Your booking on {{date}} at {{time}} is cancelled. We hope to welcome you another time.',
  },
  {
    key: 'waitlist.matched',
    subject: 'A table has opened up',
    push: 'Good news — a table for {{partySize}} on {{date}} at {{time}} is free. Tap to reserve it before it goes.',
  },
  {
    key: 'deposit.paid',
    subject: 'Deposit received',
    push: 'Thank you — your deposit of {{amount}} is received and your table on {{date}} is confirmed.',
  },
  {
    key: 'deposit.failed',
    subject: 'Deposit not completed',
    push: 'Your deposit for {{date}} did not go through. Your booking is held while you try again.',
  },
  {
    key: 'event.booked',
    subject: 'Your place is reserved',
    push: 'Your place at {{eventTitle}} on {{date}} is reserved.',
  },
  {
    key: 'event.reminder',
    subject: 'Tomorrow at Mábu',
    push: '{{eventTitle}} is tomorrow at {{time}}. We look forward to hosting you.',
  },
  {
    key: 'rewards.earned',
    subject: 'Points earned',
    push: 'You have earned {{points}} MÁBU Rewards points. Thank you for choosing Mábu.',
  },
  {
    key: 'rewards.tier',
    subject: 'Welcome to {{tierName}}',
    push: 'You are now a {{tierName}} member of MÁBU Rewards. New privileges await.',
  },
  {
    key: 'rewards.expiring',
    subject: 'Points expiring soon',
    push: '{{points}} of your MÁBU Rewards points expire in {{daysLeft}} days.',
  },
  {
    key: 'rewards.redeemed',
    subject: 'Reward ready',
    push: 'Your reward, {{rewardName}}, is ready. Show the code in the app when you visit.',
  },
  {
    key: 'voucher.purchased',
    subject: 'Your Mábu gift voucher',
    push: 'Your gift voucher for {{amount}} is issued. Thank you for giving the gift of Mábu.',
    email:
      'Dear {{purchaserName}},\n\nThank you. Your Mábu gift voucher for {{amount}} is issued and on its way to {{recipientName}}.\n\nVoucher code: {{code}}\nValid until: {{expiresAt}}\n\nThe Mábu team',
  },
  {
    key: 'voucher.received',
    subject: 'A gift from {{purchaserName}}',
    push: 'You have received a Mábu gift voucher for {{amount}}.',
    email:
      'Dear {{recipientName}},\n\n{{purchaserName}} has given you the gift of Mábu — a voucher for {{amount}}.\n\n"{{message}}"\n\nVoucher code: {{code}}\nValid until: {{expiresAt}}\n\nReserve your table in the Mábu app or at reservations@maburestaurant.com.',
  },
  {
    key: 'voucher.redeemed',
    subject: 'Voucher used',
    push: '{{amount}} of your Mábu voucher was used. Thank you for dining with us.',
  },
  {
    key: 'service.update',
    subject: '{{headline}}',
    push: '{{headline}}',
    email: '{{headline}}\n\n{{body}}\n\nThe Mábu team',
  },
  {
    key: 'marketing.campaign',
    subject: '{{headline}}',
    push: '{{headline}}',
    email:
      '{{headline}}\n\n{{body}}\n\nTo stop receiving news from Mábu, update your preferences in the app.',
  },
];

export function defaultTemplates(now: string): NotificationTemplate[] {
  const out: NotificationTemplate[] = [];
  for (const s of SEEDS) {
    out.push({
      id: `${s.key}:in-app:v1`,
      key: s.key,
      channel: 'in-app',
      subject: s.subject,
      body: s.push,
      version: 1,
      active: true,
      updatedAt: now,
      updatedBy: 'seed',
    });
    out.push({
      id: `${s.key}:push:v1`,
      key: s.key,
      channel: 'push',
      // A lock-screen title may not carry an unsafe variable; fall back to the brand.
      subject: variablesIn(s.subject).every((v) => PREVIEW_SAFE_VARIABLES.has(v))
        ? s.subject
        : 'Mábu',
      body: s.push,
      version: 1,
      active: true,
      updatedAt: now,
      updatedBy: 'seed',
    });
    out.push({
      id: `${s.key}:email:v1`,
      key: s.key,
      channel: 'email',
      subject: s.subject,
      body: s.email ?? s.push,
      version: 1,
      active: true,
      updatedAt: now,
      updatedBy: 'seed',
    });
  }
  for (const t of out) assertTemplateSafe(t);
  return out;
}
