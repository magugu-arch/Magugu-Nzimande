import { createDemoClock } from '@scarlets/adapters';
import { useAnalyticsLog, track } from '@/lib/analytics';
import { demoControls, useDemo } from '@/state/demo';
import { useMatchdayPlan } from '@/state/matchday';
import { toAccount } from '@/state/session';

describe('demo session', () => {
  it('maps the demo accounts to an API identity without any personal detail', () => {
    expect(toAccount('guest', 'dev-1')).toEqual({
      state: 'guest',
      userId: null,
      deviceId: 'dev-1',
      member: false,
    });
    expect(toAccount('supporter', 'dev-1')).toMatchObject({ state: 'signed_in', member: false });
    expect(toAccount('member', 'dev-1')).toMatchObject({ state: 'signed_in', member: true });
  });
});

describe('demo controls', () => {
  it('restarts the clock when the scenario changes', () => {
    useDemo.getState().setScenario('live');
    const { scenario, startedAt } = useDemo.getState();
    expect(scenario).toBe('live');
    expect(
      createDemoClock(scenario, startedAt, () => startedAt)
        .now()
        .toISOString(),
    ).toBe('2026-11-14T15:27:10.000Z');
    useDemo.getState().reset();
    expect(demoControls()).toMatchObject({
      scenario: 'pre_match',
      liveFeed: 'ok',
      network: 'online',
      latencyMs: 0,
    });
  });
});

describe('matchday plan', () => {
  it('ticks and unticks checklist items per fixture', () => {
    const { toggle } = useMatchdayPlan.getState();
    toggle('fx-1', 'ticket-ready');
    toggle('fx-1', 'route');
    toggle('fx-2', 'route');
    expect(useMatchdayPlan.getState().done['fx-1']).toEqual(['ticket-ready', 'route']);
    toggle('fx-1', 'ticket-ready');
    expect(useMatchdayPlan.getState().done['fx-1']).toEqual(['route']);
    expect(useMatchdayPlan.getState().done['fx-2']).toEqual(['route']);
  });

  it('remembers and clears a meeting point', () => {
    const { setMeetingPoint } = useMatchdayPlan.getState();
    setMeetingPoint('fx-1', 'meet-shop');
    expect(useMatchdayPlan.getState().meetingPoint['fx-1']).toBe('meet-shop');
    setMeetingPoint('fx-1', null);
    expect(useMatchdayPlan.getState().meetingPoint['fx-1']).toBeUndefined();
  });
});

describe('analytics', () => {
  it('records events on the device and strips anything personal', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    useAnalyticsLog.setState({ events: [] });
    track('ticket_cta_tap', {
      fixture_id: 'fx-1',
      placement: 'home_hero',
      email: 'someone@example.test',
    });
    const [event] = useAnalyticsLog.getState().events;
    expect(event?.event).toBe('ticket_cta_tap');
    expect(event?.props).toEqual({ fixture_id: 'fx-1', placement: 'home_hero' });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
