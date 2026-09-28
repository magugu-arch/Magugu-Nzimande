/** Notification contracts — brief §40, plus the delivery, template and inbox entities §46 lists. */

export type NotificationChannel = 'push' | 'email' | 'sms' | 'whatsapp' | 'in-app';

export type NotificationCategory =
  'booking' | 'event' | 'rewards' | 'voucher' | 'service' | 'marketing';

export const NOTIFICATION_CATEGORIES: NotificationCategory[] = [
  'booking',
  'event',
  'rewards',
  'voucher',
  'service',
  'marketing',
];

/**
 * Categories a guest cannot switch off entirely: a confirmed booking changing
 * is a service message, not marketing (§37). The guest still picks channels;
 * the in-app centre always keeps a copy.
 */
export const TRANSACTIONAL_CATEGORIES: NotificationCategory[] = ['booking', 'service'];

export interface QuietHours {
  /** Venue-local HH:mm. A window may cross midnight (22:00 → 07:00). */
  start: string;
  end: string;
}

export interface NotificationPreference {
  id: string;
  guestId: string;
  category: NotificationCategory;
  enabled: boolean;
  channels: NotificationChannel[];
  quietHours?: QuietHours;
  consentTimestamp?: string;
  consentSource?: string;
  updatedAt: string;
}

export type NotificationStatus =
  'scheduled' | 'queued' | 'sent' | 'partially_sent' | 'failed' | 'cancelled' | 'suppressed';

export interface NotificationMessage {
  id: string;
  guestId: string;
  category: NotificationCategory;
  templateKey: string;
  data: Record<string, unknown>;
  channels: NotificationChannel[];
  scheduledFor?: string;
  deepLink?: string;
  dedupeKey: string;
  /** Urgent messages (waitlist matches) are not held for quiet hours. */
  urgent?: boolean;
  status?: NotificationStatus;
  suppressedReason?: string;
  createdAt?: string;
  sentAt?: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  providerMessageId?: string;
  status: 'pending' | 'sent' | 'failed' | 'skipped';
  attempts: number;
  lastError?: string;
  nextAttemptAt?: string;
  sentAt?: string;
  templateVersion?: number;
}

/** §42: templates are versioned and admin-managed. */
export interface NotificationTemplate {
  id: string;
  key: string;
  channel: NotificationChannel;
  subject?: string;
  body: string;
  version: number;
  active: boolean;
  updatedAt: string;
  updatedBy: string;
}

/** The persistent in-app notification centre (§38). */
export interface InboxItem {
  id: string;
  guestId: string;
  notificationId: string;
  category: NotificationCategory;
  title: string;
  body: string;
  deepLink?: string;
  createdAt: string;
  readAt?: string;
}

export interface RenderedMessage {
  subject: string;
  body: string;
  templateVersion: number;
}

/** §40 NotificationProvider — one per channel. */
export interface NotificationProvider {
  channel: NotificationChannel;
  send(
    message: NotificationMessage,
    rendered: RenderedMessage,
  ): Promise<{ accepted: boolean; providerMessageId?: string; reason?: string }>;
}

/** §40 NotificationService. */
export interface NotificationService {
  queue(message: NotificationMessage): Promise<void>;
  sendNow(message: NotificationMessage): Promise<void>;
  cancel(dedupeKey: string): Promise<void>;
  getGuestPreferences(guestId: string): Promise<NotificationPreference[]>;
  updateGuestPreference(preference: NotificationPreference): Promise<NotificationPreference>;
}

/** A marketing campaign scheduled by admin (§44). */
/** §41 who a campaign is for. Every audience is still limited to consenting guests. */
export type CampaignAudience = 'all' | 'regulars' | 'lapsed' | 'members' | 'birthday-month';

export const CAMPAIGN_AUDIENCES: { id: CampaignAudience; label: string; description: string }[] = [
  { id: 'all', label: 'Everyone', description: 'Every guest who opted in' },
  { id: 'regulars', label: 'Regulars', description: 'Three or more visits in ninety days' },
  {
    id: 'lapsed',
    label: 'Lapsed',
    description: 'Sixty days since their last visit, nothing booked',
  },
  { id: 'members', label: 'Rewards members', description: 'Guests in MÁBU Rewards' },
  {
    id: 'birthday-month',
    label: 'Birthday this month',
    description: 'A birthday saved for this month',
  },
];

/** At most this many marketing messages reach one guest in any seven days. */
export const MARKETING_WEEKLY_CAP = 2;

export interface Campaign {
  id: string;
  name: string;
  audience?: CampaignAudience;
  templateKey: string;
  data: Record<string, unknown>;
  deepLink?: string;
  scheduledFor: string;
  status: 'scheduled' | 'sent' | 'cancelled';
  createdBy: string;
  createdAt: string;
  sentAt?: string;
  recipients?: number;
  blockedNoConsent?: number;
  /** Consenting guests left out because they had already had this week's messages. */
  heldByCap?: number;
}
