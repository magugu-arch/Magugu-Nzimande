/**
 * The operator console's rules (admin/src/lib): scoped publishing,
 * separation of duties, emergency safeguards and the audit trail.
 */
import { setClockForTesting } from '@/core/time/clock';
import { sastDate } from '@/core/time/sast';
import { estimateReach, metricsFor } from '../admin/src/lib/audience';
import { canApprove, canPublishInto } from '../admin/src/lib/operators';
import { OPERATORS, SEGMENTS, seed } from '../admin/src/lib/seed';
import {
  approveCampaign,
  getData,
  requestChanges,
  resetDemo,
  saveCampaign,
  sendEmergency,
  setOperatorRole,
  switchOperator,
  validateDraft,
  type CampaignDraft,
} from '../admin/src/lib/store';

const NOW = sastDate(2026, 10, 5, 9, 40);
const op = (id: string) => OPERATORS.find((o) => o.id === id)!;
const ayanda = op('op-ayanda');
const pieter = op('op-pieter');
const lindiwe = op('op-lindiwe');

const draft = (over: Partial<CampaignDraft> = {}): CampaignDraft => ({
  title: 'Graduation photos are ready',
  body: 'Your official graduation photos can be viewed from today.',
  category: 'community',
  priority: 'normal',
  segmentId: 'seg-students',
  deepLink: '/events',
  actionLabel: 'See events',
  sendAt: null,
  expiresAt: null,
  respectQuietHours: true,
  channels: { push: true, inApp: true },
  ...over,
});

beforeEach(() => {
  setClockForTesting(NOW);
  resetDemo();
});
afterAll(() => setClockForTesting(null));

describe('publishing is scoped (brief §16)', () => {
  it('lets operators publish only into their own areas', () => {
    expect(canPublishInto(ayanda, 'community')).toBe(true);
    expect(canPublishInto(ayanda, 'money')).toBe(false);
    expect(canPublishInto(lindiwe, 'community')).toBe(false);
    expect(canPublishInto(op('op-naledi'), 'money')).toBe(true);
  });

  it('keeps a faculty publisher inside their faculty', () => {
    const errors = validateDraft(draft({ category: 'academic' }), pieter, SEGMENTS, NOW);
    expect(errors.join(' ')).toMatch(/only reach Business & Economic Sciences/);
    expect(
      validateDraft(
        draft({ category: 'academic', segmentId: 'seg-bes-students' }),
        pieter,
        SEGMENTS,
        NOW,
      ),
    ).toEqual([]);
  });

  it('refuses emergencies, past send times and links outside the app', () => {
    const text = (d: CampaignDraft) => validateDraft(d, ayanda, SEGMENTS, NOW).join(' ');
    expect(text(draft({ priority: 'emergency' }))).toMatch(/Emergency notices/);
    expect(text(draft({ sendAt: sastDate(2026, 10, 5, 8, 0).toISOString() }))).toMatch(/future/);
    expect(text(draft({ deepLink: 'https://example.test' }))).toMatch(/NMU ONE screen/);
  });
});

describe('create → approve → deliver (brief §11)', () => {
  it('never lets an author approve their own notice', () => {
    switchOperator('op-ayanda');
    const saved = saveCampaign(draft(), null, true);
    expect(saved.ok).toBe(true);
    const campaign = getData().campaigns.find((c) => c.id === saved.id)!;
    expect(campaign.status).toBe('pending-approval');

    // Even an author who can approve may not approve their own work.
    expect(canApprove({ ...ayanda, role: 'approver' }, campaign)).toEqual({
      ok: false,
      reason: expect.stringMatching(/someone else/),
    });
    expect(approveCampaign(campaign.id, '').ok).toBe(false);

    switchOperator('op-lindiwe');
    expect(approveCampaign(campaign.id, 'Looks good').ok).toBe(true);
    const sent = getData().campaigns.find((c) => c.id === campaign.id)!;
    expect(sent.status).toBe('sent');
    expect(sent.approverId).toBe('op-lindiwe');
    expect(sent.history.map((h) => h.action)).toEqual(['created', 'submitted', 'approved', 'sent']);
  });

  it('schedules an approved notice with a future send time', () => {
    switchOperator('op-ayanda');
    const sendAt = sastDate(2026, 10, 6, 8, 0).toISOString();
    const { id } = saveCampaign(draft({ sendAt }), null, true);
    switchOperator('op-lindiwe');
    approveCampaign(id!, '');
    expect(getData().campaigns.find((c) => c.id === id)!.status).toBe('scheduled');
  });

  it('sends a notice back to its author with a reason', () => {
    switchOperator('op-lindiwe');
    expect(requestChanges('cmp-library-hours', '').ok).toBe(false);
    expect(requestChanges('cmp-library-hours', 'Confirm the dates, please.').ok).toBe(true);
    const c = getData().campaigns.find((x) => x.id === 'cmp-library-hours')!;
    expect(c.status).toBe('changes-requested');
    expect(c.history.at(-1)?.note).toBe('Confirm the dates, please.');
  });

  it('audits every change, with who made it', () => {
    switchOperator('op-ayanda');
    const before = getData().audit.length;
    saveCampaign(draft(), null, false);
    const entry = getData().audit[0]!;
    expect(getData().audit.length).toBe(before + 1);
    expect(entry).toMatchObject({ operatorId: 'op-ayanda', action: 'Saved draft' });
  });
});

describe('emergency notices and roles', () => {
  const emergency = {
    title: 'Evacuate the Library now',
    body: 'Leave by the nearest exit and gather on the Main Lawn.',
    segmentId: 'seg-everyone',
    deepLink: '/safety',
    actionLabel: 'Open Safety',
    reason: 'Fire alarm confirmed',
  };

  it('only lets approvers send them, and flags each one in the audit log', () => {
    switchOperator('op-ayanda');
    expect(sendEmergency(emergency).ok).toBe(false);
    switchOperator('op-lindiwe');
    expect(sendEmergency({ ...emergency, reason: '' }).ok).toBe(false);
    expect(sendEmergency(emergency).ok).toBe(true);
    const sent = getData().campaigns[0]!;
    expect(sent).toMatchObject({ priority: 'emergency', status: 'sent', respectQuietHours: false });
    expect(getData().audit[0]!.action).toMatch(/^EMERGENCY/);
  });

  it('stops administrators changing their own role', () => {
    switchOperator('op-naledi');
    expect(setOperatorRole('op-naledi', 'analyst').ok).toBe(false);
    expect(setOperatorRole('op-kagiso', 'approver').ok).toBe(true);
    switchOperator('op-ayanda');
    expect(setOperatorRole('op-kagiso', 'super-admin').ok).toBe(false);
  });
});

describe('audience reach and metrics', () => {
  it('narrows reach as an audience narrows, and counts nobody for an empty one', () => {
    const all = estimateReach(SEGMENTS[1]!);
    const south = estimateReach(SEGMENTS[2]!);
    const residence = estimateReach(SEGMENTS[4]!);
    expect(south).toBeLessThan(all);
    expect(residence).toBeLessThan(all);
    expect(
      estimateReach({ roles: ['alumni'], campuses: 'all', faculties: 'all', residenceOnly: true }),
    ).toBe(0);
  });

  it('only measures sent notices, and never reports more opens than deliveries', () => {
    const data = seed(NOW);
    for (const c of data.campaigns) {
      const m = metricsFor(
        c,
        data.segments.find((s) => s.id === c.segmentId),
        NOW,
      );
      if (c.status !== 'sent') {
        expect(m).toBeNull();
        continue;
      }
      expect(m!.delivered).toBeLessThanOrEqual(m!.targeted);
      expect(m!.opened).toBeLessThanOrEqual(m!.delivered);
      expect(m!.actioned).toBeLessThanOrEqual(m!.opened);
    }
  });
});
