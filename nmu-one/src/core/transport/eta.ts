import type { ShuttleArrival, ShuttleRoute } from '../domain/models';
import { sastDate, sastParts } from '../time/sast';

const parseHm = (hm: string): [number, number] => {
  const [h, m] = hm.split(':').map(Number);
  return [h ?? 0, m ?? 0];
};

/**
 * Service window for a route on the SAST day of `now`. A last departure
 * earlier than the first (00:30 after 18:00) runs past midnight.
 */
export function serviceWindow(route: ShuttleRoute, now: Date): { start: Date; end: Date } {
  const p = sastParts(now);
  const [fh, fm] = parseHm(route.firstDeparture);
  const [lh, lm] = parseHm(route.lastDeparture);
  const start = sastDate(p.year, p.month, p.day, fh, fm);
  let end = sastDate(p.year, p.month, p.day, lh, lm);
  if (end <= start) end = new Date(end.getTime() + 24 * 60 * 60_000);
  return { start, end };
}

export function isRunning(route: ShuttleRoute, now: Date): boolean {
  const { start, end } = serviceWindow(route, now);
  return now >= start && now <= end;
}

/** The route's status as a rider should see it right now. */
export function liveStatus(route: ShuttleRoute, now: Date): ShuttleRoute {
  if (isRunning(route, now)) return route;
  const { start } = serviceWindow(route, now);
  return {
    ...route,
    status: 'not-running',
    statusNote:
      now < start
        ? `First departure today at ${route.firstDeparture}.`
        : `Service has ended for today. First departure tomorrow at ${route.firstDeparture}.`,
  };
}

/**
 * Next arrival of `route` at each of its stops, from a headway timetable:
 * departures every `frequencyMinutes` from the first departure, plus each
 * stop's running offset, plus any current delay.
 */
export function nextArrivals(
  route: ShuttleRoute,
  offsets: number[],
  delayMinutes: number,
  now: Date,
): ShuttleArrival[] {
  const { start, end } = serviceWindow(route, now);
  const freqMs = route.frequencyMinutes * 60_000;
  const arrivals: ShuttleArrival[] = [];

  route.stops.forEach((stop, i) => {
    const offsetMs = ((offsets[i] ?? 0) + delayMinutes) * 60_000;
    // First departure whose arrival at this stop is still ahead of `now`.
    const k = Math.max(0, Math.ceil((now.getTime() - start.getTime() - offsetMs) / freqMs));
    const departure = new Date(start.getTime() + k * freqMs);
    if (departure > end) return;
    const arrival = new Date(departure.getTime() + offsetMs);
    arrivals.push({
      routeId: route.id,
      stopId: stop.id,
      etaMinutes: Math.max(0, Math.ceil((arrival.getTime() - now.getTime()) / 60_000)),
      live: route.status !== 'not-running' && isRunning(route, now),
      departsAt: arrival.toISOString(),
    });
  });

  return arrivals;
}
