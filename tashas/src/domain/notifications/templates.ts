/**
 * Notification templates, versioned. Copy here is SAMPLE wording for review;
 * the brief requires Tashas to approve templates (and WhatsApp/SMS templates
 * need provider approval) before live sends. Service templates carry no
 * promotional content, and no template puts contact or card details in its
 * preview text.
 */

import type { Channel, NotificationCategory } from '../types.ts';

export interface Template {
  id: string;
  version: number;
  kind: 'transactional' | 'marketing';
  category: NotificationCategory;
  /** Channels this template may use, before preferences and consent. */
  channels: Channel[];
  /** Channels sent regardless of preference toggles (service essentials). */
  required: Channel[];
  render(data: Record<string, string | number | null>): { title: string; body: string };
}

const s = (v: string | number | null | undefined) => (v === null || v === undefined ? '' : String(v));

function t(
  id: string,
  kind: Template['kind'],
  category: NotificationCategory,
  channels: Channel[],
  required: Channel[],
  render: Template['render'],
): Template {
  return { id, version: 1, kind, category, channels, required, render };
}

const SERVICE: Channel[] = ['in-app', 'email', 'push'];

export const TEMPLATES: Record<string, Template> = Object.fromEntries(
  [
    t('booking-confirmed', 'transactional', 'booking', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'Your table is booked',
      body: `${s(d.branch)}, ${s(d.date)} at ${s(d.time)} for ${s(d.party)}. Reference ${s(d.reference)}.${d.deposit ? ` Deposit paid: ${s(d.deposit)}.` : ''}`,
    })),
    t('booking-reminder', 'transactional', 'booking', SERVICE, ['in-app'], (d) => ({
      title: `See you ${s(d.when)}`,
      body: `${s(d.branch)} at ${s(d.time)}, table for ${s(d.party)}. Reference ${s(d.reference)}. Need to change it? Manage your booking in the app.`,
    })),
    t('booking-amended', 'transactional', 'booking', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'Your booking has changed',
      body: `Now ${s(d.date)} at ${s(d.time)} for ${s(d.party)} at ${s(d.branch)}. Reference ${s(d.reference)}.${d.refund ? ` ${s(d.refund)} is on its way back to you.` : ''}`,
    })),
    t('booking-cancelled', 'transactional', 'booking', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'Your booking is cancelled',
      body: `${s(d.branch)}, ${s(d.date)} at ${s(d.time)}. ${d.refund ? `A refund of ${s(d.refund)} is on its way.` : d.forfeit ? `Under the café’s policy the deposit of ${s(d.forfeit)} is not refunded.` : 'Nothing was charged.'}`,
    })),
    t('booking-cancelled-by-cafe', 'transactional', 'booking', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'The café had to cancel your booking',
      body: `We are sorry: ${s(d.branch)} cannot seat you on ${s(d.date)} at ${s(d.time)}. ${d.refund ? `Your deposit of ${s(d.refund)} is being refunded in full.` : ''}`,
    })),
    t('booking-waitlisted', 'transactional', 'booking', SERVICE, ['in-app'], (d) => ({
      title: 'You are on the waitlist',
      body: `${s(d.branch)}, ${s(d.date)} around ${s(d.time)} for ${s(d.party)}. We will let you know if a table opens up. This is not a confirmed booking.`,
    })),
    t('waitlist-opening', 'transactional', 'booking', SERVICE, ['in-app'], (d) => ({
      title: 'A table may have opened up',
      body: `A table near ${s(d.time)} on ${s(d.date)} at ${s(d.branch)} was released. Book it in the app before someone else does.`,
    })),
    t('booking-reconciliation', 'transactional', 'service', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'Your payment is safe; your table is not confirmed yet',
      body: `We received your deposit of ${s(d.amount)} but could not confirm the table at ${s(d.branch)}. Our team has been alerted and will confirm the table or refund you in full. You do not need to pay again.`,
    })),
    t('booking-failed', 'transactional', 'service', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'We could not confirm your table',
      body: `${s(d.branch)} could not confirm the table for ${s(d.date)} at ${s(d.time)}.${d.refund ? ` Your deposit of ${s(d.refund)} is being refunded in full.` : ' You have not been charged.'}`,
    })),
    t('booking-no-show', 'transactional', 'service', ['in-app', 'email'], ['in-app'], (d) => ({
      title: 'We missed you',
      body: `Your table at ${s(d.branch)} on ${s(d.date)} was marked as not attended.${d.forfeit ? ` Under the café’s policy the deposit of ${s(d.forfeit)} is kept.` : ''} If this is wrong, contact the café.`,
    })),
    t('visit-thanks', 'transactional', 'service', ['in-app', 'email'], ['in-app'], (d) => ({
      title: `Thank you for visiting ${s(d.branch)}`,
      body: 'We hope you enjoyed it. Tell us how it went from your booking in the app.',
    })),
    t('payment-receipt', 'transactional', 'service', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'Payment received',
      body: `${s(d.amount)} for ${s(d.description)}. Reference ${s(d.reference)}. Keep this as your receipt.`,
    })),
    t('payment-failed', 'transactional', 'service', SERVICE, ['in-app'], (d) => ({
      title: 'Your payment did not go through',
      body: `The payment of ${s(d.amount)} was not completed and you have not been charged. You can try again from your booking, or contact the café for help.`,
    })),
    t('payment-refunded', 'transactional', 'service', SERVICE, ['in-app', 'email'], (d) => ({
      title: 'Refund issued',
      body: `${s(d.amount)} has been refunded to your original payment method. Reference ${s(d.reference)}. Banks can take a few working days to show it.`,
    })),
    t('reward-earned', 'transactional', 'rewards', ['in-app', 'push', 'email'], [], (d) => ({
      title: `You earned ${s(d.points)} points`,
      body: `For your visit to ${s(d.branch)}. Your balance is now ${s(d.balance)} points.`,
    })),
    t('reward-redeemed', 'transactional', 'rewards', ['in-app', 'email'], ['in-app'], (d) => ({
      title: 'Your reward is ready',
      body: `${s(d.title)}. Show code ${s(d.code)} at the café before ${s(d.expires)}.`,
    })),
    t('reward-expiring', 'transactional', 'rewards', ['in-app', 'email'], [], (d) => ({
      title: `${s(d.points)} points expire soon`,
      body: `They lapse on ${s(d.expires)}. Redeem them for a reward in the app.`,
    })),
    t('event-confirmed', 'transactional', 'events', SERVICE, ['in-app', 'email'], (d) => ({
      title: `You are booked for ${s(d.event)}`,
      body: `${s(d.branch)}, ${s(d.date)} at ${s(d.time)} for ${s(d.party)}. Reference ${s(d.reference)}.`,
    })),
    t('welcome', 'marketing', 'marketing', ['email', 'push'], [], () => ({
      title: 'Welcome to Tashas',
      body: 'Thank you for joining. We will write when there is a new season on the menu or something worth booking for. Unsubscribe any time from your preferences.',
    })),
    t('campaign-weekend-brunch', 'marketing', 'marketing', ['email', 'push', 'in-app'], [], () => ({
      title: 'Brunch for the whole table',
      body: 'Weekend mornings fill quickly. Book a table for Saturday or Sunday brunch.',
    })),
    t('campaign-spring-tasting', 'marketing', 'marketing', ['email', 'push', 'in-app'], [], () => ({
      title: 'Spring menu tasting',
      body: 'Five small plates and the chefs who made them. Seats are limited.',
    })),
    t('campaign-win-back', 'marketing', 'marketing', ['email', 'push', 'in-app'], [], (d) => ({
      title: 'It has been a while',
      body: `Your table at ${s(d.branch) || 'Tashas'} is waiting. Book your next breakfast in a few taps.`,
    })),
    t('campaign-morning-coffee', 'marketing', 'marketing', ['email', 'push', 'in-app'], [], () => ({
      title: 'The first cup of the day',
      body: 'Every cup pulled at the bar and poured by hand. Find your nearest café.',
    })),
  ].map((tpl) => [tpl.id, tpl]),
);

export function template(id: string): Template {
  const tpl = TEMPLATES[id];
  if (!tpl) throw new Error(`Unknown template ${id}`);
  return tpl;
}

export const CAMPAIGN_TEMPLATES = Object.values(TEMPLATES).filter((x) => x.id.startsWith('campaign-'));
