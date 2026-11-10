import { z } from 'zod';
import { isoDateTime } from './provenance';

export const NOTIFICATION_CATEGORIES = [
  'club_news',
  'matchday',
  'tickets',
  'membership',
  'fan_moments',
  'rewards',
  'shop',
  'account',
] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_COPY: Record<
  NotificationCategory,
  { label: string; description: string; optional: boolean }
> = {
  club_news: { label: 'Club news', description: 'Announcements and stories.', optional: true },
  matchday: {
    label: 'Matchday',
    description: 'Line-ups, kick-off and full time.',
    optional: true,
  },
  tickets: { label: 'Tickets', description: 'Ticket releases and reminders.', optional: true },
  membership: { label: 'Membership', description: 'Renewals and benefits.', optional: true },
  fan_moments: {
    label: 'Fan Moments',
    description: 'When your moment is reviewed.',
    optional: true,
  },
  rewards: { label: 'Khosi Rewards', description: 'Rewards and offers.', optional: true },
  shop: { label: 'Shop', description: 'New kit and products.', optional: true },
  account: {
    label: 'Account and security',
    description: 'Sign-in and security messages. These cannot be turned off.',
    optional: false,
  },
};

/**
 * Routes a notification may open. Anything else is rejected at compose time
 * in the admin and ignored by the app, so a campaign can never deep-link a
 * supporter somewhere unexpected.
 */
export const DEEP_LINK_PATTERNS = [
  /^\/home$/,
  /^\/match$/,
  /^\/match\/[A-Za-z0-9_-]+$/,
  /^\/news\/[A-Za-z0-9_-]+$/,
  /^\/fan$/,
  /^\/fan\/mine$/,
  /^\/tickets$/,
  /^\/membership$/,
  /^\/rewards$/,
  /^\/rewards\/[A-Za-z0-9_-]+$/,
  /^\/shop$/,
  /^\/notifications$/,
] as const;

export function isAllowedDeepLink(path: string): boolean {
  return DEEP_LINK_PATTERNS.some((p) => p.test(path));
}

export const notificationSchema = z.object({
  id: z.string().min(1),
  category: z.enum(NOTIFICATION_CATEGORIES),
  title: z.string().min(1).max(65),
  body: z.string().max(178),
  deepLink: z.string().refine(isAllowedDeepLink, 'Deep link is not on the allow-list').nullable(),
  createdAt: isoDateTime,
  readAt: isoDateTime.nullable(),
  isDemo: z.boolean(),
});
export type AppNotification = z.infer<typeof notificationSchema>;

export const notificationPreferencesSchema = z.object({
  pushEnabled: z.boolean(),
  categories: z.record(z.enum(NOTIFICATION_CATEGORIES), z.boolean()),
});
export type NotificationPreferences = z.infer<typeof notificationPreferencesSchema>;

/** Everything optional starts off: supporters opt in, not out. */
export function defaultNotificationPreferences(): NotificationPreferences {
  const categories = {} as Record<NotificationCategory, boolean>;
  for (const c of NOTIFICATION_CATEGORIES) categories[c] = !NOTIFICATION_CATEGORY_COPY[c].optional;
  return { pushEnabled: false, categories };
}

export const AUDIENCES = ['opted_in_all', 'opted_in_members', 'opted_in_ticket_holders'] as const;

export const campaignSchema = z
  .object({
    id: z.string().min(1),
    category: z.enum(NOTIFICATION_CATEGORIES),
    title: z.string().trim().min(1).max(65),
    body: z.string().trim().min(1).max(178),
    deepLink: z.string().nullable(),
    audience: z.enum(AUDIENCES),
    fixtureId: z.string().nullable(),
    scheduledFor: isoDateTime.nullable(),
  })
  .refine((c) => c.deepLink === null || isAllowedDeepLink(c.deepLink), {
    message: 'Deep link is not on the allow-list.',
    path: ['deepLink'],
  })
  .refine((c) => c.audience !== 'opted_in_ticket_holders' || c.fixtureId !== null, {
    message: 'Ticket-holder campaigns must name a fixture.',
    path: ['fixtureId'],
  })
  .refine((c) => c.category !== 'account', {
    message: 'Account messages are transactional and are not sent as campaigns.',
    path: ['category'],
  });
export type Campaign = z.infer<typeof campaignSchema>;

/** A campaign can be scheduled only for the future (with a 5-minute floor). */
export function canSchedule(c: Pick<Campaign, 'scheduledFor'>, now: Date): boolean {
  if (!c.scheduledFor) return false;
  return new Date(c.scheduledFor).getTime() >= now.getTime() + 5 * 60_000;
}
