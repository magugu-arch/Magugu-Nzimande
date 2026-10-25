/**
 * Composition root. Wires storage, providers and services the same way an
 * API server would, so the browser sandbox, the tests and a future Node
 * deployment share one assembly. Provider adapters are the only thing that
 * changes between sandbox and production (see docs/ARCHITECTURE.md).
 */

import { Database } from './db.ts';
import type { Ctx } from './context.ts';
import type { Content } from './content.ts';
import { Outbox } from './outbox.ts';
import { GuestService } from './guests.ts';
import { PaymentService } from './payments/service.ts';
import { BookingService } from './booking/service.ts';
import { ConsentService } from './notifications/consent.ts';
import { NotificationService } from './notifications/service.ts';
import { defaultAdapters } from './notifications/channels.ts';
import { RewardsService } from './rewards/ledger.ts';
import { CampaignService } from './marketing/campaigns.ts';
import { EventTicketService } from './events/tickets.ts';
import { Analytics } from './analytics.ts';
import { SandboxPaymentGateway } from './sandbox/gateway.ts';
import { SandboxReservationProvider } from './sandbox/reservations.ts';
import type { Settings } from './types.ts';
import type { Clock, IdSource } from './util/core.ts';
import { createIdSource, systemClock } from './util/core.ts';
import { utf8 } from './util/sha256.ts';

export const DEFAULT_SETTINGS: Settings = {
  id: 'global',
  autoRefundOnBookingFailure: false,
  marketingFrequencyCapPerWeek: 2,
  quietHours: { start: '20:00', end: '08:00' },
  consentTextVersion: 'marketing-consent-sample-v1',
  consentText:
    'Yes, Tashas may send me news about seasonal menus, events and offers on the channel I have chosen. I can unsubscribe at any time.',
  publicAppUrl: null,
  sandbox: {
    nextCreate: 'normal',
    stealHeldSlot: false,
    duplicateWebhooks: false,
    dropWebhooks: false,
    reservationOutage: false,
    emailFailures: 0,
  },
};

export interface SystemOptions {
  content: Content;
  clock?: Clock;
  ids?: IdSource;
}

export function createTashasSystem(options: SystemOptions) {
  const db = new Database();
  const ctx: Ctx = {
    db,
    clock: options.clock ?? systemClock,
    ids: options.ids ?? createIdSource(),
    content: options.content,
  };
  const outbox = new Outbox(ctx);
  const guests = new GuestService(ctx);
  const gateway = new SandboxPaymentGateway(ctx);
  const reservations = new SandboxReservationProvider(ctx);
  const payments = new PaymentService(ctx, outbox, gateway);
  const bookings = new BookingService(ctx, outbox, reservations, payments, guests);
  const consent = new ConsentService(ctx, outbox);
  const notifications = new NotificationService(ctx, consent, defaultAdapters(ctx));
  const rewards = new RewardsService(ctx, outbox);
  const campaigns = new CampaignService(ctx, notifications, rewards);
  const tickets = new EventTicketService(ctx, outbox, payments);
  const analytics = new Analytics(ctx);

  // Order matters only for readability; each consumer is independent and idempotent.
  outbox.register(tickets.consumer);
  outbox.register(rewards.consumer);
  outbox.register(campaigns.consumer);
  outbox.register(notifications.consumer);

  function ensureSettings(): void {
    if (!db.get('settings', 'global')) db.insert('settings', DEFAULT_SETTINGS);
  }
  ensureSettings();

  /** Delivers sandbox webhooks that are due, through the real handlers. */
  async function deliverWebhooks(): Promise<number> {
    const now = ctx.clock.now();
    const due = db
      .where('sandboxWebhooks', (w) => w.deliveredAt === null && w.deliverAt <= now)
      .sort((a, b) => a.deliverAt - b.deliverAt);
    for (const w of due) {
      const body = utf8(w.body);
      if (w.target === 'payments') await payments.handleWebhook(body, w.headers);
      else await bookings.handleProviderWebhook(body, w.headers);
      db.update('sandboxWebhooks', w.id, { deliveredAt: ctx.clock.now(), attempts: w.attempts + 1 });
    }
    return due.length;
  }

  /** Runs every worker until nothing changes: the sandbox's queue runner. */
  async function settle(maxRounds = 12): Promise<void> {
    for (let round = 0; round < maxRounds; round++) {
      const before = db.version;
      await deliverWebhooks();
      outbox.dispatch();
      await bookings.work();
      await payments.work();
      await tickets.work();
      rewards.expire();
      campaigns.tick();
      await notifications.process();
      outbox.dispatch();
      if (db.version === before) return;
    }
  }

  function reset(): void {
    db.clear();
    ensureSettings();
  }

  return {
    ctx,
    db,
    outbox,
    guests,
    gateway,
    reservations,
    payments,
    bookings,
    consent,
    notifications,
    rewards,
    campaigns,
    tickets,
    analytics,
    deliverWebhooks,
    settle,
    reset,
  };
}

export type TashasSystem = ReturnType<typeof createTashasSystem>;
