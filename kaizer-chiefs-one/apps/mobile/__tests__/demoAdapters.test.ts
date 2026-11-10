import {
  COMMUNITY_RULES_VERSION,
  FAN_TERMS_VERSION,
  fixtureSchema,
  type FanConsent,
  matchSchema,
  scoreIsShowable,
} from '@kc-one/contracts';
import { demoContent } from '@/data/demo/content';
import { demoMatchData } from '@/data/demo/football';
import { demoCommerce, demoMembership, demoRewards, demoTickets } from '@/data/demo/account';
import { demoFan } from '@/data/demo/fan';
import { demoNotifications } from '@/data/demo/notifications';
import { useDemoFan } from '@/state/demoFan';

jest.mock('expo-crypto', () => {
  let n = 0;
  return { randomUUID: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}` };
});

const range = { from: '2026-01-01T00:00:00+02:00', to: '2027-12-31T00:00:00+02:00' };

describe('demo adapters never invent live club data', () => {
  it('labels every fixture demo and gives none a score, date or venue', async () => {
    const r = await demoMatchData.getFixtures(range);
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.data.length).toBeGreaterThan(0);
    for (const f of r.data) {
      expect(fixtureSchema.parse(f)).toBeTruthy();
      expect(f.provenance.state).toBe('demo');
      expect(f.score).toBeNull();
      expect(scoreIsShowable(f)).toBe(false);
      expect(f.kickoff).toBeNull();
      expect(f.venue).toBeNull();
      const opponent = f.home.isClub ? f.away : f.home;
      expect(opponent.name).toMatch(/^Opponent [A-Z]$/);
    }
  });

  it('serves matches without line-ups, events or statistics', async () => {
    const r = await demoMatchData.getMatch('demo-fx-1');
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(matchSchema.parse(r.data)).toBeTruthy();
    expect(r.data.lineups).toBeNull();
    expect(r.data.stats).toBeNull();
    expect(r.data.events).toEqual([]);
  });

  it('uses placeholder players with no likeness or biography', async () => {
    const r = await demoMatchData.getSquad('first-team');
    if (r.status !== 'ok') throw new Error('expected ok');
    for (const p of r.data.players) {
      expect(p.imagePath).toBeNull();
      expect(p.bio).toBeNull();
      expect(p.shirtNumber).toBeNull();
      expect(p.displayName).toBe('Player name');
    }
  });

  it('never claims membership, a points balance, a ticket code or a redemption', async () => {
    const m = await demoMembership.getMember('u1');
    expect(m.status === 'ok' && m.data.verificationState).toBe('not_linked');
    expect((await demoMembership.getEntitlements('u1')).status).toBe('unavailable');
    expect((await demoRewards.getWallet('u1')).status).toBe('unavailable');
    const redeem = await demoRewards.redeem(
      'u1',
      'demo-rw-1',
      '3b241101-e2bb-4255-8caf-4136c566a962',
    );
    expect(redeem).toMatchObject({ status: 'unavailable', reason: 'demo_restricted' });
    const secure = await demoTickets.getSecureTicket('demo-ticket-1');
    expect(secure).toMatchObject({ status: 'unavailable', reason: 'demo_restricted' });
  });

  it('lists rewards and products without points values, partners, prices or links', async () => {
    const rw = await demoRewards.listRewards();
    if (rw.status !== 'ok') throw new Error('expected ok');
    for (const r of rw.data) {
      expect(r.pointsCost).toBeNull();
      expect(r.partnerName).toBeNull();
    }
    const pr = await demoCommerce.getProducts();
    if (pr.status !== 'ok') throw new Error('expected ok');
    for (const p of pr.data) {
      expect(p.priceText).toBeNull();
      expect(p.productUrl).toBeNull();
    }
  });

  it('marks sample stories as demo content', async () => {
    const r = await demoContent.getHomeFeed();
    if (r.status !== 'ok') throw new Error('expected ok');
    for (const i of r.data.items) expect(i.provenance.state).toBe('demo');
    expect(demoNotifications.every((n) => n.isDemo)).toBe(true);
  });
});

describe('demo Fan Moments', () => {
  const consent: FanConsent = {
    termsVersion: FAN_TERMS_VERSION,
    communityRulesVersion: COMMUNITY_RULES_VERSION,
    rightsConfirmed: true,
    showDisplayName: false,
    acceptedAt: new Date().toISOString(),
  };
  const media = {
    mimeType: 'image/jpeg',
    bytes: 1_000_000,
    durationSeconds: null,
    width: 800,
    height: 1000,
  };

  beforeEach(() => useDemoFan.getState().clear());

  it('keeps submissions pending and on this device, and lets the owner remove them', async () => {
    const r = await demoFan.submit(
      'u1',
      { caption: 'Hi', media, showsMinors: false, guardianConsentConfirmed: false, consent },
      'file:///x.jpg',
    );
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.data.status).toBe('pending_review');
    expect(r.data.provenance.state).toBe('demo');
    const mine = await demoFan.listMine('u1');
    expect(mine.status === 'ok' && mine.data).toHaveLength(1);
    expect((await demoFan.remove('u2', r.data.id)).status).toBe('unavailable');
    expect((await demoFan.remove('u1', r.data.id)).status).toBe('ok');
    const after = await demoFan.listMine('u1');
    expect(after.status === 'ok' && after.data).toHaveLength(0);
  });

  it('escalates moments that show children and holds them from deletion', async () => {
    const r = await demoFan.submit(
      'u1',
      { caption: '', media, showsMinors: true, guardianConsentConfirmed: true, consent },
      'file:///y.jpg',
    );
    if (r.status !== 'ok') throw new Error('expected ok');
    expect(r.data.status).toBe('escalated');
    expect((await demoFan.remove('u1', r.data.id)).status).toBe('unavailable');
  });

  it('rejects a submission without guardian consent', async () => {
    const r = await demoFan.submit(
      'u1',
      { caption: '', media, showsMinors: true, guardianConsentConfirmed: false, consent },
      'file:///z.jpg',
    );
    expect(r.status).toBe('unavailable');
  });

  it('does not pretend a report was sent', async () => {
    const r = await demoFan.report('u1', { postId: 'demo-fm-1', reason: 'spam', details: null });
    expect(r).toMatchObject({ status: 'unavailable', reason: 'demo_restricted' });
  });
});
