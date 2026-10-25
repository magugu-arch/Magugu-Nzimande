/**
 * SANDBOX reservation provider. Not a real booking system.
 *
 * It behaves like a provider with holds, waitlists, amendments and signed
 * webhooks so the booking engine can be exercised end to end, including the
 * failure modes in brief §13.2 (stale slot, timeout after commit, outage).
 * Background demand is generated deterministically per slot so availability
 * looks plausible; it is not a forecast of real Tashas demand.
 */

import type { Ctx } from '../context.ts';
import { branchById, effectivePolicy } from '../content.ts';
import type { Branch, SandboxReservation, SandboxScenario } from '../types.ts';
import { DomainError, hashString } from '../util/core.ts';
import { minutesOf, timeOf, weekday } from '../util/time.ts';
import type { DateKey, TimeKey } from '../util/time.ts';
import {
  HOLD_EXPIRED,
  INVALID_SIGNATURE,
  PROVIDER_TIMEOUT,
  PROVIDER_UNAVAILABLE,
  SLOT_UNAVAILABLE,
} from '../booking/provider.ts';
import type {
  AvailabilityQuery,
  ProviderReservation,
  ProviderSlot,
  ProviderWebhookEvent,
  ReservationProvider,
} from '../booking/provider.ts';
import { SANDBOX_RESERVATIONS_SIGNING_KEY, SIGNATURE_HEADER, queueWebhook, verifySignature } from './webhooks.ts';

const FRESH_MS = 60_000;

export function slotTimes(branch: Branch, slotIntervalMinutes: number): ProviderSlot[] {
  const out: ProviderSlot[] = [];
  for (const service of branch.services) {
    for (
      let m = minutesOf(service.firstSeating);
      m <= minutesOf(service.lastSeating);
      m += slotIntervalMinutes
    ) {
      out.push({ time: timeOf(m), period: service.id, remainingCovers: 0, available: false });
    }
  }
  return out;
}

/** Deterministic background demand so the sandbox shows full and open slots. */
export function backgroundCovers(branch: Branch, date: DateKey, time: TimeKey): number {
  const r = hashString(`${branch.id}|${date}|${time}`) / 4294967296;
  const day = weekday(date);
  const weekend = day === 0 || day === 6;
  const m = minutesOf(time);
  const peak = weekend ? m >= 8 * 60 + 30 && m <= 10 * 60 + 30 : m >= 12 * 60 + 30 && m <= 13 * 60 + 30;
  let load = weekend ? 0.4 + r * 0.5 : 0.1 + r * 0.55;
  if (peak) load += 0.2;
  return Math.min(branch.sandboxCoversPerSlot, Math.round(branch.sandboxCoversPerSlot * load));
}

export class SandboxReservationProvider implements ReservationProvider {
  readonly name = 'sandbox-reservations';
  readonly label = 'Sandbox reservation provider';
  readonly isSandbox = true;
  readonly capabilities = { holds: true, waitlist: true, amend: true, revalidate: true, signedWebhooks: true };
  private ctx: Ctx;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  private scenario(): SandboxScenario {
    return this.ctx.db.require('settings', 'global').sandbox;
  }

  private setScenario(patch: Partial<SandboxScenario>): void {
    this.ctx.db.update('settings', 'global', (s) => ({ ...s, sandbox: { ...s.sandbox, ...patch } }));
  }

  private assertUp(): void {
    if (this.scenario().reservationOutage) {
      throw new DomainError(PROVIDER_UNAVAILABLE, 'The reservation provider is not responding.');
    }
  }

  /** Covers taken at a slot by background demand, sandbox bookings and live holds. */
  private taken(branchId: string, date: DateKey, time: TimeKey, except?: { holdId?: string; reservationId?: string }): number {
    const branch = branchById(this.ctx.content, branchId);
    const now = this.ctx.clock.now();
    const booked = this.ctx.db
      .where(
        'sandboxReservations',
        (r) =>
          r.branchId === branchId &&
          r.date === date &&
          r.time === time &&
          !r.waitlist &&
          r.status !== 'cancelled' &&
          r.id !== except?.reservationId,
      )
      .reduce((n, r) => n + r.partySize, 0);
    const held = this.ctx.db
      .where(
        'sandboxHolds',
        (h) =>
          h.branchId === branchId &&
          h.date === date &&
          h.time === time &&
          !h.released &&
          h.expiresAt > now &&
          h.id !== except?.holdId,
      )
      .reduce((n, h) => n + h.partySize, 0);
    return backgroundCovers(branch, date, time) + booked + held;
  }

  private remaining(branchId: string, date: DateKey, time: TimeKey, except?: { holdId?: string; reservationId?: string }): number {
    const branch = branchById(this.ctx.content, branchId);
    return Math.max(0, branch.sandboxCoversPerSlot - this.taken(branchId, date, time, except));
  }

  async availability(query: AvailabilityQuery): Promise<{ slots: ProviderSlot[]; freshUntil: number }> {
    this.assertUp();
    const branch = branchById(this.ctx.content, query.branchId);
    const interval = effectivePolicy(this.ctx, branch.id).slotIntervalMinutes;
    const slots = slotTimes(branch, interval).map((s) => {
      const remainingCovers = this.remaining(branch.id, query.date, s.time);
      return { ...s, remainingCovers, available: remainingCovers >= query.partySize };
    });
    return { slots, freshUntil: this.ctx.clock.now() + FRESH_MS };
  }

  async hold(request: AvailabilityQuery & { time: TimeKey; ttlMs: number }): Promise<{ holdId: string; expiresAt: number }> {
    this.assertUp();
    if (this.remaining(request.branchId, request.date, request.time) < request.partySize) {
      throw new DomainError(SLOT_UNAVAILABLE, 'That time has just been taken.');
    }
    const expiresAt = this.ctx.clock.now() + request.ttlMs;
    const hold = this.ctx.db.insert('sandboxHolds', {
      id: this.ctx.ids.id('hold'),
      branchId: request.branchId,
      date: request.date,
      time: request.time,
      partySize: request.partySize,
      expiresAt,
      released: false,
    });
    return { holdId: hold.id, expiresAt };
  }

  async releaseHold(holdId: string): Promise<void> {
    if (this.ctx.db.get('sandboxHolds', holdId)) this.ctx.db.update('sandboxHolds', holdId, { released: true });
  }

  async create(request: AvailabilityQuery & { time: TimeKey; holdId: string | null; idempotencyKey: string }): Promise<ProviderReservation> {
    const existing = this.ctx.db.byUnique('sandboxReservations', 'idempotencyKey', request.idempotencyKey);
    if (existing) return toProvider(existing);
    this.assertUp();

    const scenario = this.scenario();
    if (scenario.nextCreate === 'unavailable') {
      this.setScenario({ nextCreate: 'normal' });
      throw new DomainError(SLOT_UNAVAILABLE, 'The provider refused the reservation: slot no longer available.');
    }
    if (scenario.nextCreate === 'error') {
      this.setScenario({ nextCreate: 'normal' });
      throw new DomainError(PROVIDER_UNAVAILABLE, 'The provider returned an error.');
    }
    if (scenario.stealHeldSlot) {
      this.setScenario({ stealHeldSlot: false });
      if (request.holdId) await this.releaseHold(request.holdId);
      const left = this.remaining(request.branchId, request.date, request.time);
      if (left > 0) {
        this.ctx.db.insert('sandboxReservations', {
          id: this.ctx.ids.id('sres'),
          branchId: request.branchId,
          date: request.date,
          time: request.time,
          partySize: left,
          status: 'booked',
          idempotencyKey: `competitor-${this.ctx.ids.id('k')}`,
          waitlist: false,
          createdAt: this.ctx.clock.now(),
        });
      }
      throw new DomainError(SLOT_UNAVAILABLE, 'Another guest booked this time first.');
    }

    let exceptHold: string | undefined;
    if (request.holdId) {
      const hold = this.ctx.db.get('sandboxHolds', request.holdId);
      const now = this.ctx.clock.now();
      if (!hold || hold.released || hold.expiresAt <= now) {
        throw new DomainError(HOLD_EXPIRED, 'The hold on this table has expired.');
      }
      exceptHold = hold.id;
    }
    if (this.remaining(request.branchId, request.date, request.time, { holdId: exceptHold }) < request.partySize) {
      throw new DomainError(SLOT_UNAVAILABLE, 'That time has just been taken.');
    }

    const reservation = this.ctx.db.transaction(() => {
      if (exceptHold) this.ctx.db.update('sandboxHolds', exceptHold, { released: true });
      return this.ctx.db.insert('sandboxReservations', {
        id: this.ctx.ids.id('sres'),
        branchId: request.branchId,
        date: request.date,
        time: request.time,
        partySize: request.partySize,
        status: 'booked',
        idempotencyKey: request.idempotencyKey,
        waitlist: false,
        createdAt: this.ctx.clock.now(),
      });
    });

    if (scenario.nextCreate === 'timeout-after-commit') {
      this.setScenario({ nextCreate: 'normal' });
      // The reservation exists; only the response is lost.
      throw new DomainError(PROVIDER_TIMEOUT, 'The provider did not answer in time.');
    }
    return toProvider(reservation);
  }

  async lookup(idempotencyKey: string): Promise<ProviderReservation | null> {
    this.assertUp();
    const r = this.ctx.db.byUnique('sandboxReservations', 'idempotencyKey', idempotencyKey);
    return r ? toProvider(r) : null;
  }

  async amend(
    externalId: string,
    change: { date: DateKey; time: TimeKey; partySize: number },
    idempotencyKey: string,
  ): Promise<ProviderReservation> {
    this.assertUp();
    const r = this.ctx.db.require('sandboxReservations', externalId);
    const already = r.date === change.date && r.time === change.time && r.partySize === change.partySize;
    if (already) return toProvider(r);
    void idempotencyKey;
    if (this.remaining(r.branchId, change.date, change.time, { reservationId: r.id }) < change.partySize) {
      throw new DomainError(SLOT_UNAVAILABLE, 'That time is not available.');
    }
    return toProvider(this.ctx.db.update('sandboxReservations', r.id, { ...change }));
  }

  async cancel(externalId: string, idempotencyKey: string): Promise<ProviderReservation> {
    this.assertUp();
    void idempotencyKey;
    const r = this.ctx.db.require('sandboxReservations', externalId);
    if (r.status === 'cancelled') return toProvider(r);
    return toProvider(this.ctx.db.update('sandboxReservations', r.id, { status: 'cancelled' }));
  }

  async joinWaitlist(request: AvailabilityQuery & { time: TimeKey; idempotencyKey: string }): Promise<ProviderReservation> {
    this.assertUp();
    const existing = this.ctx.db.byUnique('sandboxReservations', 'idempotencyKey', request.idempotencyKey);
    if (existing) return toProvider(existing);
    return toProvider(
      this.ctx.db.insert('sandboxReservations', {
        id: this.ctx.ids.id('sres'),
        branchId: request.branchId,
        date: request.date,
        time: request.time,
        partySize: request.partySize,
        status: 'booked',
        idempotencyKey: request.idempotencyKey,
        waitlist: true,
        createdAt: this.ctx.clock.now(),
      }),
    );
  }

  /**
   * What café staff would do in the provider's own tool: seat a table, mark it
   * completed or a no-show. The change reaches Tashas only as a signed webhook.
   */
  staffUpdate(externalId: string, status: 'seated' | 'completed' | 'no-show' | 'cancelled'): void {
    const r = this.ctx.db.require('sandboxReservations', externalId);
    this.ctx.db.update('sandboxReservations', r.id, { status });
    queueWebhook(
      this.ctx,
      'reservations',
      SANDBOX_RESERVATIONS_SIGNING_KEY,
      {
        id: this.ctx.ids.id('rev'),
        type: 'reservation.updated',
        created: this.ctx.clock.now(),
        data: { externalId, status },
      },
      { duplicate: this.scenario().duplicateWebhooks, latencyMs: 400 },
    );
  }

  verifyWebhook(rawBody: Uint8Array, headers: Record<string, string>): ProviderWebhookEvent {
    const body = new TextDecoder().decode(rawBody);
    if (!verifySignature(SANDBOX_RESERVATIONS_SIGNING_KEY, body, headers[SIGNATURE_HEADER], this.ctx.clock.now())) {
      throw new DomainError(INVALID_SIGNATURE, 'Webhook signature did not verify.');
    }
    const parsed = JSON.parse(body) as {
      id: string;
      created: number;
      data: { externalId: string; status: ProviderReservation['status'] };
    };
    return { eventId: parsed.id, externalId: parsed.data.externalId, status: parsed.data.status, occurredAt: parsed.created };
  }
}

function toProvider(r: SandboxReservation): ProviderReservation {
  return { externalId: r.id, status: r.status, date: r.date, time: r.time, partySize: r.partySize };
}
