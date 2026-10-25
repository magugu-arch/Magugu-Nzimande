/**
 * SANDBOX seed: a sample guest profile for the person exploring the app and a
 * synthetic population of clearly named demo guests, so campaign audiences,
 * consent exclusions and KPIs have something to work on. Nothing here is a
 * real person. Past visits are written as history; the upcoming booking runs
 * through the real booking flow.
 */

import type { TashasSystem } from './system.ts';
import { staff } from './roles.ts';
import { DAY, HOUR, mulberry32 } from './util/core.ts';
import { addDays, dateKeyAt, toEpoch, weekday } from './util/time.ts';
import type { Channel } from './types.ts';

export const SAMPLE_GUEST = {
  name: 'Alex Sample',
  email: 'alex.sample@example.com',
  phone: '082 555 0134',
};

function pastVisit(sys: TashasSystem, guestId: string, branchId: string, daysAgo: number, partySize: number): string {
  const { db, ids, clock } = sys.ctx;
  const branch = sys.ctx.content.branches.find((b) => b.id === branchId)!;
  const date = addDays(dateKeyAt(clock.now(), branch.utcOffsetMinutes), -daysAgo);
  const time = daysAgo % 2 === 0 ? '09:30' : '12:45';
  const startsAt = toEpoch(date, time, branch.utcOffsetMinutes);
  const res = db.insert('sandboxReservations', {
    id: ids.id('sres'),
    branchId,
    date,
    time,
    partySize,
    status: 'completed',
    idempotencyKey: ids.id('seed'),
    waitlist: false,
    createdAt: startsAt - 3 * DAY,
  });
  const booking = db.insert('bookings', {
    id: ids.id('bkg'),
    reference: ids.reference('TSH'),
    guestId,
    branchId,
    provider: sys.bookings.provider.name,
    externalId: res.id,
    status: 'completed',
    date,
    time,
    period: time < '11:30' ? 'breakfast' : 'lunch',
    startsAt,
    partySize,
    policyVersion: branch.policy.version,
    depositAmountMinor: 0,
    depositPaidMinor: 0,
    depositRefundedMinor: 0,
    paymentIds: [],
    occasion: null,
    specialRequest: null,
    seating: null,
    attemptId: null,
    attribution: null,
    version: 1,
    createdAt: startsAt - 3 * DAY,
    updatedAt: startsAt + 2 * HOUR,
  });
  const rules = sys.ctx.content.rewardRules;
  db.insert('rewardLedger', {
    id: ids.id('rwd'),
    guestId,
    type: 'earn',
    points: rules.pointsPerCompletedVisit,
    referenceType: 'visit',
    referenceId: booking.id,
    idempotencyKey: `visit:${booking.id}`,
    createdAt: new Date(startsAt + 3 * HOUR).toISOString(),
    expiresAt: new Date(startsAt + rules.pointExpiryDays * DAY).toISOString(),
    reversesEntryId: null,
    note: `Rules ${rules.version}`,
  });
  return booking.id;
}

/** Creates the sample profile the app opens with. Returns its guest id. */
export async function seedSampleGuest(sys: TashasSystem): Promise<string> {
  const guest = sys.guests.create({ name: SAMPLE_GUEST.name, email: SAMPLE_GUEST.email, phone: SAMPLE_GUEST.phone });
  sys.db.update('guests', guest.id, { homeBranchId: 'rosebank' });
  sys.db.insert('favourites', { id: sys.ctx.ids.id('fav'), guestId: guest.id, kind: 'branch', refId: 'rosebank', createdAt: sys.ctx.clock.now() });
  sys.db.insert('favourites', { id: sys.ctx.ids.id('fav'), guestId: guest.id, kind: 'menu-item', refId: 'avocado-toast', createdAt: sys.ctx.clock.now() });
  pastVisit(sys, guest.id, 'rosebank', 40, 2);
  pastVisit(sys, guest.id, 'morningside', 18, 3);
  const last = pastVisit(sys, guest.id, 'rosebank', 5, 2);
  sys.notifications.enqueue({
    guestId: guest.id,
    templateId: 'reward-earned',
    data: { points: sys.ctx.content.rewardRules.pointsPerCompletedVisit, balance: sys.rewards.balance(guest.id), branch: 'Tashas Rosebank' },
    dedupeKey: `reward-earned:${last}`,
    link: { screen: 'rewards' },
  });

  // An upcoming weekday lunch at a no-deposit café, booked through the real flow.
  const branch = sys.ctx.content.branches.find((b) => b.id === 'morningside')!;
  let date = addDays(dateKeyAt(sys.ctx.clock.now(), branch.utcOffsetMinutes), 3);
  while (weekday(date) === 0 || weekday(date) === 6) date = addDays(date, 1);
  const attempt = sys.bookings.startAttempt({ guestId: guest.id, branchId: branch.id, idempotencyKey: sys.ctx.ids.id('seedk'), attribution: null });
  const availability = await sys.bookings.availability(branch.id, date, 2);
  const slot = availability.periods.find((p) => p.id === 'lunch')?.slots.find((s) => s.available && s.time >= '12:30');
  if (slot) {
    await sys.bookings.selectSlot(attempt.id, { date, time: slot.time, partySize: 2 });
    sys.bookings.setGuestDetails(attempt.id, { ...SAMPLE_GUEST, occasion: 'Catch-up', seating: 'Terrace' });
    await sys.bookings.submit(attempt.id, { policyAccepted: true });
  }
  await sys.settle();
  return guest.id;
}

/** Thirty-six synthetic guests with varied history and consent. */
export function seedDemoPopulation(sys: TashasSystem, seed = 20261025): void {
  const rand = mulberry32(seed);
  const pick = <T>(xs: T[]) => xs[Math.floor(rand() * xs.length)]!;
  const branchIds = sys.ctx.content.branches.map((b) => b.id);
  const actor = { kind: 'system' as const, id: 'demo-seed' };
  for (let i = 1; i <= 36; i++) {
    const n = String(i).padStart(2, '0');
    const bounce = i === 7 || i === 23;
    const guest = sys.guests.create({
      name: `Demo guest ${n}`,
      email: bounce ? `demo.bounce${n}@example.com` : `demo.guest${n}@example.com`,
      phone: null,
      isDemoPopulation: true,
    });
    const home = pick(branchIds);
    sys.db.update('guests', guest.id, { homeBranchId: home });
    const visits = Math.floor(rand() * 5);
    for (let v = 0; v < visits; v++) pastVisit(sys, guest.id, rand() < 0.7 ? home : pick(branchIds), 10 + Math.floor(rand() * 160), 1 + Math.floor(rand() * 4));
    const channels: Channel[] = [];
    if (rand() < 0.6) channels.push('email');
    if (rand() < 0.3) {
      channels.push('push');
      sys.guests.registerPushToken(guest.id, i % 11 === 0 ? `sandbox-invalid-${n}` : `sandbox-token-${n}`);
    }
    for (const c of channels) sys.consent.grant(guest.id, c, 'demo-seed', actor);
    if (i % 9 === 0 && channels.includes('email')) sys.consent.withdraw(guest.id, 'email', 'unsubscribe-link', actor);
  }
  // The welcome messages the grants above would trigger are not part of the demo history.
  sys.outbox.dispatch();
  sys.notifications.cancelScheduled((n) => n.templateId === 'welcome');

  const marketer = staff('marketer');
  const draft = sys.campaigns.create(
    {
      name: 'Weekend brunch · Gauteng regulars',
      channel: 'email',
      templateId: 'campaign-weekend-brunch',
      audience: { branchIds: ['rosebank', 'hyde-park', 'morningside', 'menlyn'], minCompletedVisits: 1 },
      landingSlug: 'weekend-brunch',
      utm: { source: 'email', medium: 'email', campaign: 'weekend-brunch', content: 'regulars' },
    },
    marketer,
  );
  sys.campaigns.submitForApproval(draft.id, marketer);
  sys.campaigns.create(
    {
      name: 'We miss you · lapsed 90 days',
      channel: 'email',
      templateId: 'campaign-win-back',
      audience: { branchIds: [], inactiveForDays: 90, minCompletedVisits: 1 },
      landingSlug: 'morning-coffee',
      utm: { source: 'email', medium: 'email', campaign: 'win-back' },
      frequencyCapPerWeek: 1,
    },
    marketer,
  );
}
