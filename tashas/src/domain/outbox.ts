/**
 * Durable domain events (brief §13.9).
 *
 * `publish` writes the event into the outbox table inside the caller's
 * transaction, so a booking that commits always has its event and a rolled
 * back booking never does. `dispatch` hands each event to every consumer in a
 * transaction of its own, records which consumers have it, retries failures
 * with backoff and parks an event in the dead-letter state after
 * MAX_ATTEMPTS so staff can inspect and replay it.
 */

import type { Ctx } from './context.ts';
import { raiseAlert } from './context.ts';
import type { EventEnvelope, OutboxRow, TashasDomainEvent } from './types.ts';

export const SCHEMA_VERSION = 1;
export const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 60 * 60_000;

export interface Consumer {
  name: string;
  handle(event: TashasDomainEvent, envelope: EventEnvelope<TashasDomainEvent>): void;
}

export function backoffMs(attempts: number): number {
  return Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, attempts - 1));
}

function aggregateOf(event: TashasDomainEvent): string {
  switch (event.type) {
    case 'booking.started':
    case 'booking.failed':
    case 'booking.reconciliation-required':
      return event.attemptId;
    case 'booking.confirmed':
    case 'booking.cancelled':
    case 'booking.completed':
    case 'booking.amended':
    case 'booking.no-show':
    case 'booking.waitlisted':
      return event.bookingId;
    case 'payment.succeeded':
    case 'payment.failed':
    case 'payment.refunded':
    case 'payment.cancelled':
      return event.paymentId;
    case 'reward.earned':
    case 'reward.redeemed':
    case 'guest.consent-changed':
      return event.guestId;
    case 'campaign.conversion':
      return event.campaignId;
    case 'event-booking.confirmed':
      return event.eventBookingId;
  }
}

export class Outbox {
  private ctx: Ctx;
  private consumers: Consumer[] = [];

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  register(consumer: Consumer): void {
    this.consumers.push(consumer);
  }

  publish(event: TashasDomainEvent, correlationId: string): OutboxRow {
    const { db, ids, clock } = this.ctx;
    return db.insert('outbox', {
      id: ids.id('evt'),
      eventType: event.type,
      schemaVersion: SCHEMA_VERSION,
      aggregateId: aggregateOf(event),
      correlationId,
      payload: event,
      occurredAt: clock.now(),
      publishedAt: null,
      attempts: 0,
      nextAttemptAt: null,
      deliveredTo: [],
      status: 'pending',
      lastError: null,
    });
  }

  envelope(row: OutboxRow): EventEnvelope<TashasDomainEvent> {
    return {
      eventId: row.id,
      occurredAt: new Date(row.occurredAt).toISOString(),
      schemaVersion: row.schemaVersion,
      correlationId: row.correlationId,
      payload: row.payload,
    };
  }

  /** Processes due events until none remain; returns how many were attempted. */
  dispatch(maxRounds = 20): number {
    const { db, clock } = this.ctx;
    let processed = 0;
    for (let round = 0; round < maxRounds; round++) {
      const now = clock.now();
      const due = db
        .where('outbox', (r) => r.status === 'pending' && (r.nextAttemptAt ?? 0) <= now)
        .sort((a, b) => a.occurredAt - b.occurredAt);
      if (due.length === 0) break;
      for (const row of due) {
        this.deliver(row.id);
        processed++;
      }
    }
    return processed;
  }

  private deliver(rowId: string): void {
    const { db, clock } = this.ctx;
    let row = db.require('outbox', rowId);
    const envelope = this.envelope(row);
    let failed: string | null = null;

    for (const consumer of this.consumers) {
      if (row.deliveredTo.includes(consumer.name)) continue;
      try {
        db.transaction(() => {
          consumer.handle(row.payload, envelope);
          row = db.update('outbox', rowId, (r) => ({
            ...r,
            deliveredTo: [...r.deliveredTo, consumer.name],
          }));
        });
      } catch (err) {
        failed = `${consumer.name}: ${err instanceof Error ? err.message : String(err)}`;
        row = db.require('outbox', rowId);
      }
    }

    if (failed === null) {
      db.update('outbox', rowId, { status: 'published', publishedAt: clock.now(), lastError: null });
      return;
    }

    const attempts = row.attempts + 1;
    if (attempts >= MAX_ATTEMPTS) {
      db.transaction(() => {
        db.update('outbox', rowId, { attempts, status: 'dead-letter', lastError: failed });
        raiseAlert(this.ctx, {
          severity: 'critical',
          title: 'Event moved to dead-letter queue',
          body: `${row.eventType} failed ${attempts} times. Last error: ${failed}`,
          entityType: 'outbox',
          entityId: rowId,
        });
      });
    } else {
      db.update('outbox', rowId, {
        attempts,
        nextAttemptAt: clock.now() + backoffMs(attempts),
        lastError: failed,
      });
    }
  }

  /** Staff action: put a dead-lettered event back in the queue. */
  replay(rowId: string): OutboxRow {
    return this.ctx.db.update('outbox', rowId, {
      status: 'pending',
      attempts: 0,
      nextAttemptAt: null,
    });
  }
}
