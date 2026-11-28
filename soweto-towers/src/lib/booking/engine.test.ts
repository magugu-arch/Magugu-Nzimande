import { describe, expect, it } from 'vitest';
import { activities } from '@/content/catalog';
import { defaultCapacity } from '@/lib/data/settings-types';
import { dayHours } from '@/lib/hours';
import { sunsetHm } from '@/lib/sun';
import { buildSlots, itemsForPackage, liveActivities, onlineCapacity, packagePeople, quote, safetyErrors, slotTimes } from './engine';

const catalog = liveActivities();
const bungee = activities.find((a) => a.id === 'bungee-jump')!;
const paintball = activities.find((a) => a.id === 'paintball')!;
const scad = activities.find((a) => a.id === 'scad-freefall')!;

describe('quote', () => {
  it('prices Jump + Film at R760 per person', () => {
    const q = quote(itemsForPackage('jump-film', 1, { 'bungee-jump': '11:00' }), 'jump-film', catalog);
    expect(q.errors).toEqual([]);
    expect(q.subtotal).toBe(800);
    expect(q.packageSaving).toBe(40);
    expect(q.total).toBe(760);
  });

  it('prices The Full Tower at R1,090 per person', () => {
    const items = itemsForPackage('full-tower', 2, { 'bungee-jump': '11:00', 'scad-freefall': '12:00' });
    const q = quote(items, 'full-tower', catalog);
    expect(q.errors).toEqual([]);
    expect(q.total).toBe(1090 * 2);
  });

  it('applies the group rate from 6 jumpers', () => {
    const q = quote([{ activityId: 'bungee-jump', qty: 6, time: '11:00', video: 0, photos: 0 }], null, catalog);
    expect(q.total).toBe(580 * 6);
    expect(q.groupSaving).toBe(50 * 6);
    expect(q.lines[0]!.groupRate).toBe(true);
  });

  it('keeps the bundle saving on top of the group rate', () => {
    const q = quote(itemsForPackage('jump-film', 6, { 'bungee-jump': '11:00' }), 'jump-film', catalog);
    expect(q.total).toBe((580 + 170 - 40) * 6);
  });

  it('refuses a package that does not match the cart', () => {
    const q = quote([{ activityId: 'bungee-jump', qty: 2, time: '11:00', video: 1, photos: 0 }], 'jump-film', catalog);
    expect(q.packageSaving).toBe(0);
    expect(q.errors.length).toBe(1);
  });

  it('never adds video where it is already included', () => {
    const q = quote([{ activityId: 'scad-freefall', qty: 1, time: '11:00', video: 1, photos: 0 }], null, catalog);
    expect(q.errors[0]).toMatch(/already included/);
    expect(q.total).toBe(400);
  });

  it('enforces paintball group sizes', () => {
    const q = quote([{ activityId: 'paintball', qty: 1, time: '11:00', video: 0, photos: 0 }], null, catalog);
    expect(q.errors[0]).toMatch(/2 to 10/);
  });

  it('uses staff price overrides and switches', () => {
    const live = liveActivities({ 'bungee-jump': { price: 650 }, zipline: { disabled: true } });
    expect(quote([{ activityId: 'bungee-jump', qty: 1, time: '11:00', video: 0, photos: 0 }], null, live).total).toBe(650);
    expect(quote([{ activityId: 'zipline', qty: 1, time: '11:00', video: 0, photos: 0 }], null, live).errors.length).toBe(1);
  });

  it('cannot be driven by client-side quantities', () => {
    const q = quote([{ activityId: 'bungee-jump', qty: 1, time: '11:00', video: 5, photos: -3 }], null, catalog);
    expect(q.total).toBe(630 + 170);
  });
});

describe('packagePeople', () => {
  it('counts people when every component matches', () => {
    expect(packagePeople(itemsForPackage('full-tower', 3), 'full-tower')).toBe(3);
  });
});

describe('slots', () => {
  const friday = '2027-02-12';
  const thursday = '2027-02-11';
  const monday = '2027-02-15';

  it('opens at 10:00 on Fridays and stops 30 minutes before sunset', () => {
    const times = slotTimes(bungee, dayHours(friday), defaultCapacity);
    expect(times[0]).toBe('10:00');
    const last = times.at(-1)!;
    const [sh, sm] = sunsetHm(friday).split(':').map(Number);
    const [lh, lm] = last.split(':').map(Number);
    expect(sh! * 60 + sm! - (lh! * 60 + lm!)).toBeGreaterThanOrEqual(30);
  });

  it('opens at 12:00 on Thursdays and is closed on Mondays', () => {
    expect(slotTimes(bungee, dayHours(thursday), defaultCapacity)[0]).toBe('12:00');
    expect(slotTimes(bungee, dayHours(monday), defaultCapacity)).toEqual([]);
  });

  it('runs paintball only Friday to Sunday in hour-long sessions ending by sunset', () => {
    expect(slotTimes(paintball, dayHours(thursday), defaultCapacity)).toEqual([]);
    const times = slotTimes(paintball, dayHours(friday), defaultCapacity);
    expect(times[1]).toBe('11:00');
  });

  it('holds back 30% of each slot for walk-ins', () => {
    expect(onlineCapacity(bungee, defaultCapacity)).toBe(4);
    expect(onlineCapacity(paintball, defaultCapacity)).toBe(1);
  });

  it('subtracts used places and closes slots inside the cut-off', () => {
    const slots = buildSlots(bungee, dayHours(friday), defaultCapacity, { '10:00': 3 }, { date: friday, minutes: 10 * 60 + 15 });
    expect(slots[0]!.remaining).toBe(1);
    expect(slots[0]!.closed).toBe(true);
    expect(slots[1]!.closed).toBe(true); // 10:30 is inside the 30-minute cut-off
    expect(slots[2]!.closed).toBe(false);
  });

  it('needs 24 hours notice for paintball', () => {
    const slots = buildSlots(paintball, dayHours(friday), defaultCapacity, {}, { date: '2027-02-11', minutes: 12 * 60 });
    expect(slots.find((s) => s.time === '11:00')!.closed).toBe(true);
    expect(slots.find((s) => s.time === '13:00')!.closed).toBe(false);
  });
});

describe('safety', () => {
  const base = { allTwelvePlus: true, medicalOk: true, guardianName: '' };

  it('passes a jumper inside the limits', () => {
    expect(safetyErrors([bungee], { ...base, participants: [{ name: 'Thandi', weightKg: 64, minor: false }] })).toEqual([]);
  });

  it('applies the lower SCAD limit', () => {
    const errs = safetyErrors([bungee, scad], { ...base, participants: [{ name: 'Sipho', weightKg: 105, minor: false }] });
    expect(errs).toEqual(['Sipho: SCAD Freefall is for 35–100 kg.']);
  });

  it('requires weights, a guardian for minors, the age and medical confirmations', () => {
    const errs = safetyErrors([bungee], {
      participants: [{ name: 'Lebo', weightKg: null, minor: true }],
      allTwelvePlus: false,
      medicalOk: false,
      guardianName: '',
    });
    expect(errs).toHaveLength(4);
  });
});
