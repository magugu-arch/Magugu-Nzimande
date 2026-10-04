import { findBuilding, parseRoomCode, routeTo, shortestPath } from '@/core/campus/routing';
import { southCampus } from '@/core/fixtures/campus';
import { shuttleRoutes, stopOffsets } from '@/core/fixtures/campusLife';
import { isRunning, liveStatus, nextArrivals, serviceWindow } from '@/core/transport/eta';
import { sastDate, formatTime } from '@/core/time/sast';

describe('room codes and buildings', () => {
  it('parses building letters and the floor', () => {
    expect(parseRoomCode('EB212')).toEqual({ buildingCode: 'EB', floor: 2, code: 'EB212' });
    expect(parseRoomCode('gb 101')).toEqual({ buildingCode: 'GB', floor: 1, code: 'GB101' });
    expect(parseRoomCode('EB21')).toBeNull();
    expect(parseRoomCode('Library')).toBeNull();
  });

  it('finds buildings by code, room or name', () => {
    expect(findBuilding(southCampus, 'EB212')?.id).toBe('eb');
    expect(findBuilding(southCampus, 'lib')?.id).toBe('lib');
    expect(findBuilding(southCampus, 'student centre')?.id).toBe('sc');
    expect(findBuilding(southCampus, 'nowhere')).toBeNull();
  });
});

describe('wayfinding', () => {
  it('takes the shortest walkway path', () => {
    expect(shortestPath(southCampus, 'gate', 'e2')).toEqual(['gate', 'w1', 'w2', 'w3', 'e2']);
    expect(shortestPath(southCampus, 'gate', 'missing')).toBeNull();
  });

  it('describes the route to a room, including the floor', () => {
    const eb = findBuilding(southCampus, 'EB')!;
    const route = routeTo(southCampus, 'gate', eb, 2)!;
    expect(route.steps[0]).toBe('Head north from Main Gate');
    expect(route.steps).toContain('Turn right at Lecture Walk');
    expect(route.steps[route.steps.length - 1]).toBe('Take the stairs or lift to level 2');
    expect(route.walkingMinutes).toBeGreaterThan(3);
    expect(route.walkingMinutes).toBeLessThan(15);
  });

  it('every building is reachable from the main gate', () => {
    for (const b of southCampus.buildings) expect(routeTo(southCampus, 'gate', b)).not.toBeNull();
  });
});

describe('shuttle ETAs', () => {
  const a = shuttleRoutes.find((r) => r.id === 'route-a')!;
  const n = shuttleRoutes.find((r) => r.id === 'route-n')!;

  it('times the next departure from the headway', () => {
    const now = sastDate(2026, 10, 5, 9, 40);
    const [first] = nextArrivals(a, stopOffsets['route-a']!, 0, now);
    expect(first!.etaMinutes).toBe(5);
    expect(formatTime(first!.departsAt)).toBe('09:45');
  });

  it('adds stop offsets and delays', () => {
    const now = sastDate(2026, 10, 5, 9, 40);
    const arrivals = nextArrivals(a, stopOffsets['route-a']!, 5, now);
    // 09:45 (+5 late) at the interchange and gate; the bus that left at 09:25
    // is still on its way to North Campus and arrives there at 09:44.
    expect(arrivals.map((x) => formatTime(x.departsAt))).toEqual(['09:50', '09:53', '09:44']);
  });

  it('runs a late-night service past midnight', () => {
    const { start, end } = serviceWindow(n, sastDate(2026, 10, 5, 20, 0));
    expect(formatTime(start)).toBe('18:00');
    expect(formatTime(end)).toBe('00:30');
    expect(end.getTime()).toBeGreaterThan(start.getTime());
    expect(isRunning(n, sastDate(2026, 10, 5, 23, 50))).toBe(true);
  });

  it('says plainly when a route is not running', () => {
    const morning = liveStatus(n, sastDate(2026, 10, 5, 9, 40));
    expect(morning.status).toBe('not-running');
    expect(morning.statusNote).toBe('First departure today at 18:00.');
    const late = liveStatus(a, sastDate(2026, 10, 5, 23, 0));
    expect(late.statusNote).toContain('Service has ended');
  });
});
