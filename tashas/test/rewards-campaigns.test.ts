import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { guestActor, makeSystem, nextWeekday, openSlot, startBooking } from './helpers.ts';
import { DAY, MINUTE, isDomainError } from '../src/domain/util/core.ts';
import { staff } from '../src/domain/roles.ts';
import { buildTrackedQuery, parseAttribution, recordTouch } from '../src/domain/marketing/attribution.ts';
import { seedDemoPopulation, seedSampleGuest } from '../src/domain/seed.ts';
import { computeKpis } from '../src/domain/analytics.ts';

describe('rewards ledger', () => {
  test('earns once per verified visit, however often the event arrives', () => {
    const { sys } = makeSystem();
    const g = sys.guests.create({ name: 'Guest', email: 'g@example.com', phone: null });
    for (let i = 0; i < 3; i++) {
      sys.outbox.publish({ type: 'booking.completed', bookingId: 'b1', guestId: g.id, branchId: 'rosebank' }, 'c');
    }
    sys.outbox.dispatch();
    assert.equal(sys.rewards.balance(g.id), 50);
    assert.equal(sys.db.where('rewardLedger', (e) => e.guestId === g.id).length, 1);
  });

  test('redeeming issues a voucher, deducts points and refuses when short', () => {
    const { sys } = makeSystem();
    const g = sys.guests.create({ name: 'Guest', email: 'g@example.com', phone: null });
    for (const b of ['b1', 'b2', 'b3', 'b4']) sys.rewards.earnForVisit(g.id, b);
    assert.equal(sys.rewards.balance(g.id), 200);
    const v = sys.rewards.redeem(g.id, 'coffee', 'redeem-1');
    assert.match(v.code, /^TV-/);
    assert.equal(sys.rewards.balance(g.id), 50);
    assert.equal(sys.rewards.redeem(g.id, 'coffee', 'redeem-1').id, v.id, 'same key, same voucher');
    assert.equal(sys.rewards.balance(g.id), 50);
    assert.throws(() => sys.rewards.redeem(g.id, 'coffee', 'redeem-2'), (e) => isDomainError(e, 'insufficient_points'));
  });

  test('expires unspent points first-in, first-out, leaves newer points and lapses vouchers', () => {
    const { sys, clock } = makeSystem();
    const g = sys.guests.create({ name: 'Guest', email: 'g@example.com', phone: null });
    sys.rewards.earnForVisit(g.id, 'v1');
    sys.rewards.earnForVisit(g.id, 'v2');
    sys.rewards.earnForVisit(g.id, 'v3');
    clock.advance(200 * DAY);
    sys.rewards.earnForVisit(g.id, 'v4');
    const v = sys.rewards.redeem(g.id, 'coffee', 'r'); // 150 points, from v1–v3
    clock.advance(170 * DAY); // v1–v3 lapse at 365 days; v4 is still valid
    assert.equal(sys.rewards.expire(), 0, 'v1–v3 were fully spent, nothing to expire');
    assert.equal(sys.rewards.balance(g.id), 50);
    assert.equal(sys.db.require('vouchers', v.id).status, 'expired');
    clock.advance(200 * DAY);
    assert.equal(sys.rewards.expire(), 1);
    assert.equal(sys.rewards.balance(g.id), 0);
    assert.equal(sys.rewards.expire(), 0, 'idempotent');
  });

  test('reversals and adjustments are staff-only and audited', () => {
    const { sys } = makeSystem();
    const g = sys.guests.create({ name: 'Guest', email: 'g@example.com', phone: null });
    const earn = sys.rewards.earnForVisit(g.id, 'mistake')!;
    assert.throws(() => sys.rewards.reverse(earn.id, guestActor(g.id), 'x'), (e) => isDomainError(e, 'forbidden'));
    sys.rewards.reverse(earn.id, staff('manager'), 'Visit recorded in error');
    sys.rewards.reverse(earn.id, staff('manager'), 'again');
    assert.equal(sys.rewards.balance(g.id), 0);
    assert.equal(sys.rewards.summary(g.id).lifetime, 0);
    sys.rewards.adjust(g.id, 25, staff('admin'), 'Service recovery', 'adj-1');
    assert.equal(sys.rewards.balance(g.id), 25);
    assert.ok(sys.db.where('audit', (a) => a.action === 'reward.reversed').length >= 1);
  });

  test('tiers follow lifetime points', () => {
    const { sys } = makeSystem();
    const g = sys.guests.create({ name: 'Guest', email: 'g@example.com', phone: null });
    for (let i = 0; i < 6; i++) sys.rewards.earnForVisit(g.id, `v${i}`);
    const s = sys.rewards.summary(g.id);
    assert.equal(s.tier.id, 'oak');
    assert.equal(s.nextTier?.id, 'brass');
    assert.equal(s.nextTier?.pointsToGo, 450);
  });
});

describe('campaigns', () => {
  function seeded() {
    const ctx = makeSystem();
    seedDemoPopulation(ctx.sys);
    return ctx;
  }

  test('need a second person to approve before anything can be sent', () => {
    const { sys } = seeded();
    const marketer = staff('marketer');
    const c = sys.campaigns.list().find((x) => x.status === 'pending-approval')!;
    assert.throws(() => sys.campaigns.sendNow(c.id, marketer), (e) => isDomainError(e, 'not_approved'));
    assert.throws(() => sys.campaigns.approve(c.id, marketer), (e) => isDomainError(e, 'forbidden'));
    const selfMade = sys.campaigns.create(
      { name: 'Mine', channel: 'email', templateId: 'campaign-morning-coffee', audience: { branchIds: [] }, landingSlug: 'morning-coffee', utm: { source: 'email', medium: 'email', campaign: 'x' } },
      staff('admin', 'alex-admin'),
    );
    sys.campaigns.submitForApproval(selfMade.id, staff('admin', 'alex-admin'));
    assert.doesNotThrow(() => sys.campaigns.approve(selfMade.id, staff('admin', 'alex-admin')), 'admins may approve their own');
    assert.equal(sys.campaigns.approve(c.id, staff('manager')).status, 'approved');
  });

  test('only marketing templates can be used', () => {
    const { sys } = seeded();
    assert.throws(
      () => sys.campaigns.create({ name: 'Bad', channel: 'email', templateId: 'payment-receipt', audience: { branchIds: [] }, landingSlug: 'x', utm: { source: 'a', medium: 'b', campaign: 'c' } }, staff('marketer')),
      (e) => isDomainError(e, 'invalid_template'),
    );
  });

  test('the audience preview and the send apply the same consent and suppression rules', async () => {
    const { sys } = seeded();
    const c = sys.campaigns.list().find((x) => x.status === 'pending-approval')!;
    sys.campaigns.approve(c.id, staff('manager'));
    const preview = sys.campaigns.preview(c.id);
    assert.ok(preview.targeted > 0);
    assert.ok(preview.eligible < preview.targeted, 'some are excluded');
    assert.ok((preview.excluded['no-consent'] ?? 0) > 0);
    for (const name of preview.sample) assert.doesNotMatch(name, /guest \d\d/, 'names are masked');

    // One eligible guest opts out after the preview, before the send.
    const eligibleGuest = sys.campaigns
      .audience(c)
      .find((g) => sys.consent.hasMarketingConsent(g.id, 'email') && !sys.consent.suppressionFor(g, 'email'))!;
    sys.consent.withdraw(eligibleGuest.id, 'email', 'unsubscribe-link', guestActor(eligibleGuest.id));

    sys.campaigns.sendNow(c.id, staff('marketer'));
    await sys.settle();
    const stats = sys.campaigns.stats(c.id);
    assert.equal(stats.targeted, preview.targeted);
    assert.equal(stats.sent + stats.failed + stats.blockedAtSend, preview.targeted);
    assert.ok(stats.sent <= preview.eligible - 1, 'the late opt-out was not sent');
    const late = sys.db.where('notifications', (n) => n.campaignId === c.id && n.guestId === eligibleGuest.id)[0]!;
    assert.equal(late.status, 'suppressed');
  });

  test('pausing stops scheduled sends', () => {
    const { sys, clock } = seeded();
    const c = sys.campaigns.list().find((x) => x.status === 'pending-approval')!;
    sys.campaigns.approve(c.id, staff('manager'));
    sys.campaigns.schedule(c.id, clock.now() + DAY, staff('marketer'));
    sys.campaigns.pause(c.id, staff('marketer'));
    clock.advance(2 * DAY);
    sys.campaigns.tick();
    assert.equal(sys.campaigns.get(c.id).status, 'paused');
    assert.equal(sys.db.where('notifications', (n) => n.campaignId === c.id).length, 0);
  });
});

describe('attribution', () => {
  test('tracked links carry UTM and campaign id but never personal data', () => {
    const q = buildTrackedQuery({ source: 'email', medium: 'email', campaign: 'weekend-brunch' }, 'cmp_1', 'weekend-brunch');
    assert.equal(q, 'utm_source=email&utm_medium=email&utm_campaign=weekend-brunch&cid=cmp_1&page=weekend-brunch');
    const parsed = parseAttribution(`?${q}&email=someone@example.com&phone=0821234567`);
    assert.deepEqual(parsed, { utm: { source: 'email', medium: 'email', campaign: 'weekend-brunch' }, campaignId: 'cmp_1', landingSlug: 'weekend-brunch' });
    assert.equal(parseAttribution('?utm_source=x'), null, 'incomplete UTM is ignored');
  });

  test('first and last touch survive landing page → booking → payment and count as a conversion', async () => {
    const { sys, clock } = makeSystem();
    seedDemoPopulation(sys);
    const c = sys.campaigns.list().find((x) => x.status === 'pending-approval')!;
    sys.campaigns.approve(c.id, staff('manager'));
    sys.campaigns.sendNow(c.id, staff('marketer'));
    await sys.settle();

    const first = { utm: { source: 'instagram', medium: 'paid-social', campaign: 'spring' }, campaignId: null, landingSlug: null, at: clock.now() - DAY };
    const last = { utm: c.utm, campaignId: c.id, landingSlug: c.landingSlug, at: clock.now() };
    const attribution = recordTouch(recordTouch(null, first), last);
    assert.equal(attribution.firstTouch?.utm.source, 'instagram');

    const date = nextWeekday(sys, 2, 3);
    const time = await openSlot(sys, 'rosebank', date, 6);
    const attempt = sys.bookings.startAttempt({ guestId: null, branchId: 'rosebank', idempotencyKey: 'attr', attribution });
    await sys.bookings.selectSlot(attempt.id, { date, time, partySize: 6 });
    sys.bookings.setGuestDetails(attempt.id, { name: 'Attr Guest', email: 'attr@example.com', phone: '0821112222' });
    const r = await sys.bookings.submit(attempt.id, { policyAccepted: true });
    if (r.status !== 'checkout') throw new Error('expected checkout');
    assert.equal(sys.payments.get(r.paymentId).metadata.campaign, 'weekend-brunch');
    assert.ok(!JSON.stringify(sys.payments.get(r.paymentId).metadata).includes('attr@example.com'));

    sys.gateway.completeCheckout(sys.payments.get(r.paymentId).providerPaymentId!, 'succeed');
    clock.advance(MINUTE);
    await sys.settle();
    const booking = sys.db.where('bookings', (b) => b.attemptId === attempt.id)[0]!;
    assert.equal(booking.attribution?.lastTouch?.campaignId, c.id);
    assert.equal(sys.campaigns.stats(c.id).attributedBookings, 1);
  });

  test('conversions outside the attribution window are not credited', async () => {
    const { sys, clock } = makeSystem();
    seedDemoPopulation(sys);
    const c = sys.campaigns.list().find((x) => x.status === 'pending-approval')!;
    const last = { utm: c.utm, campaignId: c.id, landingSlug: c.landingSlug, at: clock.now() - 8 * DAY };
    const date = nextWeekday(sys, 3, 2);
    const time = await openSlot(sys, 'morningside', date, 2);
    const attemptId = await startBooking(sys, { branchId: 'morningside', date, time, partySize: 2 });
    sys.db.update('bookingAttempts', attemptId, { attribution: { firstTouch: last, lastTouch: last } });
    await sys.bookings.submit(attemptId, { policyAccepted: true });
    await sys.settle();
    assert.equal(sys.campaigns.stats(c.id).attributedBookings, 0);
  });
});

describe('sandbox seed and KPIs', () => {
  test('the sample guest opens with history, points, an upcoming booking and an inbox', async () => {
    const { sys } = makeSystem();
    const id = await seedSampleGuest(sys);
    assert.equal(sys.rewards.balance(id), 150);
    const upcoming = sys.db.where('bookings', (b) => b.guestId === id && b.status === 'confirmed');
    assert.equal(upcoming.length, 1);
    assert.ok(sys.notifications.inbox(id).length >= 2);
  });

  test('KPIs are computed from observed records', async () => {
    const { sys } = makeSystem();
    await seedSampleGuest(sys);
    seedDemoPopulation(sys);
    const k = computeKpis(sys.ctx);
    assert.equal(k.bookingConversion.confirmed, 1);
    assert.equal(k.bookingConversion.qualifiedStarts, 1);
    assert.equal(k.bookingConversion.value, 1);
    assert.ok(k.repeatGuestRate.visited > 0);
    assert.ok(k.optOutRate.withdrawals > 0);
    assert.equal(k.byBranch.length, 6);
  });
});
