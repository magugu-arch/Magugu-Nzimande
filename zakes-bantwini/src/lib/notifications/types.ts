import type { NotificationChannel } from '@/lib/booking/types';

/** Brief §10 NOTIFICATIONS — every event the booking workflow announces. */
export const NOTIFICATION_EVENTS = [
  'enquiry_received',
  'quote_ready',
  'quote_accepted',
  'contract_ready',
  'contract_signed',
  'deposit_requested',
  'deposit_received',
  'balance_received',
  'payment_failed',
  'booking_confirmed',
  'balance_reminder',
  'event_reminder',
] as const;
export type NotificationEvent = (typeof NOTIFICATION_EVENTS)[number];

export type OutboundMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** WhatsApp template parameters; providers that use templates read these. */
  templateParams?: string[];
};

export type SendResult = { status: 'sent' | 'logged' | 'skipped'; provider: string; providerId?: string };

/** One delivery channel. Providers are swapped by configuration, not by code changes. */
export interface ChannelAdapter {
  readonly channel: NotificationChannel;
  readonly provider: string;
  send(message: OutboundMessage, event: NotificationEvent): Promise<SendResult>;
}
