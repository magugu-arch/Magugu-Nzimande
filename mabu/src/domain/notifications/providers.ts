import type { ServiceContext } from '../context';
import { nowIso } from '../context';
import type {
  NotificationChannel,
  NotificationMessage,
  NotificationProvider,
  RenderedMessage,
} from './types';

/** Writes to the persistent in-app notification centre. Always available. */
export class InAppProvider implements NotificationProvider {
  readonly channel = 'in-app' as const;
  constructor(private readonly ctx: ServiceContext) {}

  async send(message: NotificationMessage, rendered: RenderedMessage) {
    const id = `inbox_${message.id}`;
    if (!this.ctx.db.inbox.has(id)) {
      this.ctx.db.inbox.insert({
        id,
        guestId: message.guestId,
        notificationId: message.id,
        category: message.category,
        title: rendered.subject,
        body: rendered.body,
        deepLink: message.deepLink,
        createdAt: nowIso(this.ctx),
      });
    }
    return { accepted: true, providerMessageId: id };
  }
}

export interface OutboxEntry {
  channel: NotificationChannel;
  to: string;
  subject: string;
  body: string;
  deepLink?: string;
  at: string;
}

/**
 * Stand-in for a transactional email / push / SMS gateway. Records what would
 * have been sent — visible in Admin → Outbox — and can be told to fail so the
 * retry path is exercised. `onSend` lets the app surface mock pushes as real
 * local notifications on the device.
 */
export class MockChannelProvider implements NotificationProvider {
  readonly outbox: OutboxEntry[] = [];
  failNext = 0;
  onSend?: (entry: OutboxEntry) => void;

  constructor(
    readonly channel: NotificationChannel,
    private readonly ctx: ServiceContext,
  ) {}

  async send(message: NotificationMessage, rendered: RenderedMessage) {
    if (this.failNext > 0) {
      this.failNext -= 1;
      return { accepted: false, reason: `${this.channel} gateway timeout (simulated)` };
    }
    const guest = this.ctx.db.guests.get(message.guestId);
    const to =
      (typeof message.data.toEmail === 'string' &&
        this.channel === 'email' &&
        message.data.toEmail) ||
      (this.channel === 'email'
        ? guest?.email
        : this.channel === 'push'
          ? `device:${message.guestId}`
          : guest?.phone) ||
      'unknown';
    const entry: OutboxEntry = {
      channel: this.channel,
      to,
      subject: rendered.subject,
      body: rendered.body,
      deepLink: message.deepLink,
      at: nowIso(this.ctx),
    };
    this.outbox.unshift(entry);
    if (this.outbox.length > 200) this.outbox.pop();
    try {
      this.onSend?.(entry);
    } catch {
      // A device-side display failure is not a delivery failure.
    }
    return { accepted: true, providerMessageId: `${this.channel}_${this.ctx.ids.code(10)}` };
  }
}

/**
 * SMS and WhatsApp need an approved South African provider, templates and a
 * consent process (§38) before they can send. Until then they refuse.
 */
export class UnconfiguredChannelProvider implements NotificationProvider {
  constructor(readonly channel: NotificationChannel) {}
  async send() {
    return { accepted: false, reason: `${this.channel.toUpperCase()}_NOT_CONFIGURED` };
  }
}
