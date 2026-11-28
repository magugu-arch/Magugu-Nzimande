/**
 * Data for the booking planner on the one-file page (scripts/share-page/planner.js):
 * what can be booked, opening hours, slot rules and contacts, all from the
 * website's own modules. Totals for every group size come from the website's
 * booking engine, so the planner shows exactly what the site would charge
 * (group rates and bundle savings included) without repeating the rules.
 */
import { activities, getPackage, packages, type ActivityId } from '../../src/content/catalog';
import { site } from '../../src/content/site';
import { itemsForPackage, liveActivities, MAX_PER_BOOKING, quote, type CartItem } from '../../src/lib/booking/engine';
import { defaultCapacity } from '../../src/lib/data/settings-types';
import { LAST_START_BEFORE_SUNSET_MIN } from '../../src/lib/hours';

export type PlanOption = {
  id: string;
  name: string;
  note: string;
  /** The activity whose slots this option books. */
  activity: ActivityId;
  min: number;
  max: number;
  /** Hourly sessions on set weekdays, booked ahead (paintball). */
  session?: { weekdays: number[]; minutes: number; leadHours: number };
  recommended?: boolean;
  /** One more line for the message, where the crew fits in a second activity. */
  followUp?: string;
};

export type PlanData = {
  whatsapp: string;
  email: string;
  geo: { lat: number; lng: number };
  /** 0 = Sunday … 6 = Saturday; null = closed. */
  weeklyOpening: Record<number, string | null>;
  slotMinutes: number;
  cutoffMinutes: number;
  horizonDays: number;
  lastStartBeforeSunset: number;
  options: PlanOption[];
  /** Total for 1, 2, … max people (null below the minimum), per option. */
  prices: Record<string, (number | null)[]>;
};

export function buildPlanData(): PlanData {
  const catalog = liveActivities();
  const options: PlanOption[] = [
    ...packages.map((p) => ({
      id: p.id,
      name: p.name,
      note: p.blurb.replace(/\.$/, ''),
      activity: p.components[0]!.activityId,
      min: 1,
      max: MAX_PER_BOOKING,
      recommended: p.recommended,
      followUp: p.components.length > 1 ? 'The crew fits the SCAD freefall in after the jump.' : undefined,
    })),
    // The plain bungee jump is "The Jump" bundle above, so it isn't listed twice.
    ...activities
      .filter((a) => a.booking.mode !== 'enquiry' && a.id !== 'bungee-jump')
      .map((a) => {
        const b = a.booking;
        const session = b.mode === 'session' ? { weekdays: b.weekdays, minutes: b.minutes, leadHours: b.leadHours } : undefined;
        return {
          id: a.id,
          name: a.name,
          note: a.short.replace(/\.$/, ''),
          activity: a.id,
          min: b.mode === 'session' ? b.minGroup : 1,
          max: b.mode === 'session' ? b.maxGroup : MAX_PER_BOOKING,
          session,
        };
      }),
  ];

  const prices: PlanData['prices'] = {};
  for (const o of options) {
    const pkg = getPackage(o.id);
    prices[o.id] = Array.from({ length: o.max }, (_, i) => {
      const qty = i + 1;
      if (qty < o.min) return null;
      const items: CartItem[] = pkg ? itemsForPackage(pkg.id, qty) : [{ activityId: o.activity, qty, time: '', video: 0, photos: 0 }];
      const q = quote(items, pkg ? pkg.id : null, catalog);
      if (q.errors.length) throw new Error(`${o.name} × ${qty}: ${q.errors.join(' ')}`);
      return q.total;
    });
  }

  return {
    whatsapp: site.whatsapp.digits,
    email: site.email,
    geo: { lat: site.geo.lat, lng: site.geo.lng },
    weeklyOpening: { ...site.weeklyOpening },
    slotMinutes: defaultCapacity.slotMinutes,
    cutoffMinutes: defaultCapacity.cutoffMinutes,
    horizonDays: defaultCapacity.horizonDays,
    lastStartBeforeSunset: LAST_START_BEFORE_SUNSET_MIN,
    options,
    prices,
  };
}
