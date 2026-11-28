import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';
import { getActivity } from '@/content/catalog';
import { defaultCapacity } from '@/lib/data/settings-types';
import { dayHours } from '@/lib/hours';
import { addDays } from '@/lib/time';
import { buildPlanData, type PlanOption } from '../../../scripts/share-page/plan-data';
import { buildSlots, liveActivities, quote } from './engine';

/**
 * The one-file page's booking planner (scripts/share-page/planner.js) runs in
 * the browser with its own copy of the date and slot rules. These tests hold
 * it to the website's engine, day by day, so the two can't drift apart.
 */
type Planner = {
  dayHours: (ymd: string) => { open: boolean; opensAt: string | null; sunset: string; lastStart: string | null };
  slots: (opt: PlanOption, ymd: string, now: { date: string; minutes: number }) => { time: string; golden: boolean; closed: boolean }[];
  dayState: (opt: PlanOption, ymd: string, now: { date: string; minutes: number }) => string;
  total: (opt: PlanOption, qty: number) => number | null;
  nowInSast: (ms: number) => { date: string; minutes: number };
  compose: (sel: Record<string, unknown>) => { text: string; subject: string; whatsapp: string; email: string };
};

const data = buildPlanData();
const source = readFileSync(path.resolve(import.meta.dirname, '../../../scripts/share-page/planner.js'), 'utf8');
const context: { createPlanner?: (d: typeof data) => Planner } = {};
vm.runInNewContext(source, context);
const planner = context.createPlanner!(data);
const option = (id: string) => data.options.find((o) => o.id === id)!;

// Two years of days, every weekday and both solstices.
const days = Array.from({ length: 730 }, (_, i) => addDays('2026-01-01', i));

describe('share page planner', () => {
  it('opens and closes on the same days and times as the website, with the same sunset', () => {
    for (const ymd of days) {
      const ours = planner.dayHours(ymd);
      const site = dayHours(ymd);
      expect({ ymd, open: ours.open, opensAt: ours.opensAt, sunset: ours.sunset, lastStart: ours.lastStart }).toEqual({
        ymd,
        open: site.open,
        opensAt: site.opensAt,
        sunset: site.sunset,
        lastStart: site.lastStart,
      });
    }
  });

  it('offers the same start times, sunset slots and cut-offs as the booking engine', () => {
    const catalog = liveActivities();
    for (const o of data.options) {
      const activity = catalog.find((a) => a.id === o.activity)!;
      for (const ymd of days) {
        // The day before at noon, and the day itself at 11:10 (inside the same-day cut-off for some slots).
        for (const now of [
          { date: addDays(ymd, -1), minutes: 12 * 60 },
          { date: ymd, minutes: 11 * 60 + 10 },
        ]) {
          const engine = buildSlots(activity, dayHours(ymd), defaultCapacity, {}, now).map((s) => ({ time: s.time, golden: s.goldenHour, closed: s.closed }));
          expect({ id: o.id, ymd, now, slots: planner.slots(o, ymd, now) }).toEqual({ id: o.id, ymd, now, slots: engine });
        }
      }
    }
  });

  it('prices every group size as the booking engine does', () => {
    const catalog = liveActivities();
    const bungee = option('the-jump');
    expect(planner.total(bungee, 1)).toBe(getActivity('bungee-jump')!.price);
    expect(planner.total(bungee, 6)).toBe(quote([{ activityId: 'bungee-jump', qty: 6, time: '', video: 0, photos: 0 }], 'the-jump', catalog).total);
    expect(planner.total(option('paintball'), 1)).toBeNull();
    expect(planner.total(option('paintball'), 4)).toBe(4 * getActivity('paintball')!.price);
  });

  it('keeps paintball to its own days, a day ahead', () => {
    const paintball = option('paintball');
    const now = { date: '2026-12-03', minutes: 11 * 60 }; // Thursday 11:00
    expect(planner.dayState(paintball, '2026-12-03', now)).toBe('closed'); // Thursday: no games
    expect(planner.dayState(option('zipline'), '2026-12-03', now)).toBe('open');
    const friday = planner.slots(paintball, '2026-12-04', now);
    expect(friday.find((s) => s.time === '10:00')!.closed).toBe(true); // 23 hours ahead: too soon
    expect(friday.find((s) => s.time === '11:00')!.closed).toBe(false); // 24 hours ahead: fine
    expect(planner.dayState(paintball, '2026-12-04', now)).toBe('open');
    expect(planner.dayState(paintball, '2026-12-01', now)).toBe('past');
  });

  it('reads the clock in South African time', () => {
    expect(planner.nowInSast(Date.parse('2026-12-04T22:30:00Z'))).toEqual({ date: '2026-12-05', minutes: 30 });
  });

  it('writes the request for WhatsApp and email', () => {
    const msg = planner.compose({ opt: option('jump-film'), qty: 2, date: '2026-12-05', time: '15:30', name: 'Thandi', phone: '', note: 'Birthday!' });
    expect(msg.text).toContain('Jump + Film for 2 people');
    expect(msg.text).toContain('Saturday 5 December 2026 at 15:30');
    expect(msg.text).toContain(`Estimated total: R${(planner.total(option('jump-film'), 2)! / 1000).toFixed(3).replace('.', ',')}`);
    expect(msg.text).toContain('Name: Thandi');
    expect(msg.text).not.toContain('Phone:');
    expect(msg.whatsapp).toBe(`https://wa.me/${data.whatsapp}?text=${encodeURIComponent(msg.text)}`);
    expect(msg.email.startsWith(`mailto:${data.email}?subject=`)).toBe(true);
    expect(decodeURIComponent(msg.email.split('&body=')[1]!)).toBe(msg.text.replace(/\n/g, '\r\n'));
    expect(msg.subject).toBe('Booking request: Jump + Film, Sat 5 Dec at 15:30, 2 people');
  });
});
