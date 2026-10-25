/**
 * Measurement (brief §7, §13.14): a privacy-aware event log and the KPIs
 * defined in the brief, computed from what actually happened. Nothing here
 * estimates revenue; numbers are labelled as observed sandbox data.
 */

import type { Ctx } from './context.ts';
import type { AnalyticsEvent } from './types.ts';
import { DAY, MINUTE } from './util/core.ts';
import { describeSource } from './marketing/attribution.ts';

const PII_KEYS = /email|phone|mobile|name|address|card|token/i;

export const FUNNELS: { id: string; label: string; steps: string[] }[] = [
  { id: 'branch', label: 'Branch search to booking', steps: ['branch_search', 'branch_view', 'booking_start', 'booking_confirmed'] },
  { id: 'menu', label: 'Menu to booking', steps: ['menu_view', 'menu_item_view', 'booking_start', 'booking_confirmed'] },
  { id: 'rewards', label: 'Rewards to redemption', steps: ['rewards_view', 'reward_redeemed'] },
  { id: 'campaign', label: 'Campaign visit to conversion', steps: ['campaign_view', 'campaign_cta', 'booking_confirmed'] },
];

export class Analytics {
  private ctx: Ctx;
  enabled = true;

  constructor(ctx: Ctx) {
    this.ctx = ctx;
  }

  track(name: string, props: AnalyticsEvent['props'], sessionId: string, campaign: string | null = null): void {
    if (!this.enabled) return;
    const clean: AnalyticsEvent['props'] = {};
    for (const [k, v] of Object.entries(props)) {
      if (PII_KEYS.test(k)) continue;
      clean[k] = typeof v === 'string' ? v.slice(0, 120) : v;
    }
    this.ctx.db.insert('analytics', {
      id: this.ctx.ids.id('anl'),
      name,
      at: this.ctx.clock.now(),
      sessionId,
      props: clean,
      campaign,
    });
  }

  funnel(steps: string[]): { step: string; sessions: number }[] {
    const events = this.ctx.db.all('analytics');
    const sessionsAt = steps.map((s) => new Set(events.filter((e) => e.name === s).map((e) => e.sessionId)));
    return steps.map((step, i) => {
      // A session counts at a step only if it reached every earlier step too.
      let set = sessionsAt[i]!;
      for (let j = 0; j < i; j++) set = new Set([...set].filter((x) => sessionsAt[j]!.has(x)));
      return { step, sessions: set.size };
    });
  }
}

export interface Kpis {
  bookingConversion: { value: number | null; confirmed: number; qualifiedStarts: number };
  paymentSuccess: { value: number | null; succeeded: number; initiated: number };
  abandonment: { value: number | null; abandoned: number; attempts: number };
  reconciliation: { open: number; valueMinor: number };
  cancellationRate: number | null;
  noShowRate: number | null;
  notificationHealth: { delivered: number; failed: number; retrying: number; blocked: number; bounced: number; total: number };
  optOutRate: { value: number | null; withdrawals: number; consented: number };
  repeatGuestRate: { value: number | null; repeat: number; visited: number };
  bySource: { source: string; starts: number; confirmed: number }[];
  byBranch: { branchId: string; confirmed: number; cancelled: number; noShow: number; completed: number }[];
}

const ratio = (a: number, b: number) => (b === 0 ? null : a / b);

export function computeKpis(ctx: Ctx, excludeDemo = false): Kpis {
  const { db, clock } = ctx;
  const now = clock.now();
  const demoGuests = new Set(db.where('guests', (g) => g.isDemoPopulation).map((g) => g.id));
  const keep = (guestId: string | null) => !excludeDemo || !guestId || !demoGuests.has(guestId);
  const attempts = db.where('bookingAttempts', (a) => a.amendsBookingId === null && keep(a.guestId));
  const qualified = attempts.filter((a) => a.selectedSlot !== null);
  const confirmed = attempts.filter((a) => a.bookingId !== null && a.state === 'confirmed');
  const abandoned = attempts.filter(
    (a) => !['confirmed', 'waitlisted'].includes(a.state) && now - a.createdAt > 30 * MINUTE,
  );
  const payments = db.where('payments', (p) => keep(p.guestId));
  const succeeded = payments.filter((p) => ['succeeded', 'refund-pending', 'partially-refunded', 'refunded'].includes(p.status));
  const recon = db.where('bookingAttempts', (a) => a.state === 'reconciliation');
  const bookings = db.where('bookings', (b) => b.status !== 'waitlisted' && keep(b.guestId));
  const deliveries = db.all('notificationDeliveries');
  const consents = db.all('guestConsents');
  const withdrawals = consents.filter((c) => c.status === 'withdrawn').length;
  const granted = consents.filter((c) => c.status === 'granted').length;

  const visitsByGuest = new Map<string, number>();
  for (const b of bookings.filter((x) => x.status === 'completed' && now - x.startsAt < 365 * DAY)) {
    visitsByGuest.set(b.guestId, (visitsByGuest.get(b.guestId) ?? 0) + 1);
  }
  const repeat = [...visitsByGuest.values()].filter((n) => n >= 2).length;

  const sources = new Map<string, { starts: number; confirmed: number }>();
  for (const a of qualified) {
    const key = describeSource(a.attribution);
    const row = sources.get(key) ?? { starts: 0, confirmed: 0 };
    row.starts++;
    if (a.state === 'confirmed') row.confirmed++;
    sources.set(key, row);
  }

  return {
    bookingConversion: { value: ratio(confirmed.length, qualified.length), confirmed: confirmed.length, qualifiedStarts: qualified.length },
    paymentSuccess: { value: ratio(succeeded.length, payments.length), succeeded: succeeded.length, initiated: payments.length },
    abandonment: { value: ratio(abandoned.length, attempts.length), abandoned: abandoned.length, attempts: attempts.length },
    reconciliation: { open: recon.length, valueMinor: recon.reduce((n, a) => n + a.depositAmountMinor, 0) },
    cancellationRate: ratio(bookings.filter((b) => b.status === 'cancelled').length, bookings.length),
    noShowRate: ratio(
      bookings.filter((b) => b.status === 'no-show').length,
      bookings.filter((b) => b.status === 'no-show' || b.status === 'completed').length,
    ),
    notificationHealth: {
      delivered: deliveries.filter((d) => d.status === 'delivered' || d.status === 'accepted').length,
      failed: deliveries.filter((d) => d.status === 'failed').length,
      retrying: deliveries.filter((d) => d.status === 'retrying').length,
      blocked: deliveries.filter((d) => d.status === 'blocked').length,
      bounced: deliveries.filter((d) => d.status === 'bounced').length,
      total: deliveries.length,
    },
    optOutRate: { value: ratio(withdrawals, granted), withdrawals, consented: granted },
    repeatGuestRate: { value: ratio(repeat, visitsByGuest.size), repeat, visited: visitsByGuest.size },
    bySource: [...sources.entries()].map(([source, v]) => ({ source, ...v })).sort((a, b) => b.starts - a.starts),
    byBranch: ctx.content.branches.map((br) => {
      const bs = bookings.filter((b) => b.branchId === br.id);
      return {
        branchId: br.id,
        confirmed: bs.filter((b) => ['confirmed', 'amended', 'completed', 'no-show'].includes(b.status)).length,
        cancelled: bs.filter((b) => b.status === 'cancelled').length,
        noShow: bs.filter((b) => b.status === 'no-show').length,
        completed: bs.filter((b) => b.status === 'completed').length,
      };
    }),
  };
}
