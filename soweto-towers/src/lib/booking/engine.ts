/**
 * The booking engine: pure functions, shared by the browser (live totals) and
 * the server (the only place a price is ever trusted). No I/O in this file.
 */
import { activities as baseActivities, addons, getPackage, type Activity, type ActivityId, type PackageId, type Resource } from '@/content/catalog';
import type { CapacityConfig, PriceOverrides } from '@/lib/data/settings-types';
import type { DayHours } from '@/lib/hours';
import { hmToMinutes, minutesToHm, weekday, type Hm, type Ymd } from '@/lib/time';

// ---------- Live catalog (code defaults + staff overrides) ----------

export type LiveActivity = Activity & { disabled: boolean };

export function liveActivities(overrides: PriceOverrides = {}): LiveActivity[] {
  return baseActivities.map((a) => {
    const o = overrides[a.id] ?? {};
    return {
      ...a,
      price: o.price ?? a.price,
      group: a.group ? { ...a.group, price: o.groupPrice ?? a.group.price } : undefined,
      disabled: !!o.disabled,
    };
  });
}

// ---------- Quotes ----------

export type CartItem = {
  activityId: ActivityId;
  qty: number;
  time: Hm;
  /** How many of the `qty` people want the video / photo pack. */
  video: number;
  photos: number;
};

export type QuoteLine = {
  kind: 'activity' | 'addon';
  sku: string;
  label: string;
  qty: number;
  unitPrice: number;
  total: number;
  activityId: ActivityId;
  time?: Hm;
  resource?: Resource;
  units?: number;
  groupRate?: boolean;
};

export type Quote = {
  lines: QuoteLine[];
  subtotal: number;
  /** Already inside the line prices; shown so people see what the group rate saved. */
  groupSaving: number;
  packageSaving: number;
  total: number;
  packageId: PackageId | null;
  errors: string[];
};

export const MAX_PER_BOOKING = 30;

export function quote(items: CartItem[], packageId: PackageId | null, catalog: LiveActivity[]): Quote {
  const errors: string[] = [];
  const lines: QuoteLine[] = [];
  let groupSaving = 0;

  for (const item of items) {
    const a = catalog.find((x) => x.id === item.activityId);
    if (!a) {
      errors.push(`Unknown adventure: ${item.activityId}`);
      continue;
    }
    if (a.disabled || a.booking.mode === 'enquiry') {
      errors.push(`${a.name} can’t be booked online right now.`);
      continue;
    }
    const qty = Math.floor(item.qty);
    if (!(qty >= 1 && qty <= MAX_PER_BOOKING)) {
      errors.push(`Choose between 1 and ${MAX_PER_BOOKING} people for ${a.name}.`);
      continue;
    }
    if (a.booking.mode === 'session' && (qty < a.booking.minGroup || qty > a.booking.maxGroup)) {
      errors.push(`${a.name} sessions take ${a.booking.minGroup} to ${a.booking.maxGroup} players.`);
    }
    const grouped = !!a.group && qty >= a.group.min;
    const unit = grouped ? a.group!.price : a.price;
    groupSaving += (a.price - unit) * qty;
    const unitsPerPerson = a.booking.mode === 'slots' ? a.booking.unitsPerPerson : 0;
    lines.push({
      kind: 'activity',
      sku: a.id,
      label: a.name,
      qty,
      unitPrice: unit,
      total: unit * qty,
      activityId: a.id,
      time: item.time,
      resource: a.booking.resource,
      units: a.booking.mode === 'session' ? 1 : unitsPerPerson * qty,
      groupRate: grouped,
    });

    const video = clampInt(item.video, 0, qty);
    const photos = clampInt(item.photos, 0, qty);
    if (video > 0) {
      if (a.videoIncluded || !a.addons.includes('video')) errors.push(`Video is ${a.videoIncluded ? 'already included' : 'not offered'} for ${a.name}.`);
      else
        lines.push({
          kind: 'addon',
          sku: `video:${a.id}`,
          label: `${addons.video.name} · ${a.name}`,
          qty: video,
          unitPrice: addons.video.price,
          total: addons.video.price * video,
          activityId: a.id,
        });
    }
    if (photos > 0) {
      if (!a.addons.includes('photos')) errors.push(`Photos aren’t offered for ${a.name}.`);
      else
        lines.push({
          kind: 'addon',
          sku: `photos:${a.id}`,
          label: `${addons.photos.name} · ${a.name}`,
          qty: photos,
          unitPrice: addons.photos.price,
          total: addons.photos.price * photos,
          activityId: a.id,
        });
    }
  }

  const subtotal = lines.reduce((s, l) => s + l.total, 0);
  let packageSaving = 0;
  let appliedPackage: PackageId | null = null;
  if (packageId) {
    const people = packagePeople(items, packageId);
    const pkg = getPackage(packageId);
    if (pkg && people > 0) {
      packageSaving = pkg.saving * people;
      appliedPackage = packageId;
    } else {
      errors.push('That package doesn’t match the adventures selected.');
    }
  }

  return { lines, subtotal, groupSaving, packageSaving, total: Math.max(0, subtotal - packageSaving), packageId: appliedPackage, errors };
}

/** A package applies when every person does every component (with video where it says so). */
export function packagePeople(items: CartItem[], packageId: PackageId): number {
  const pkg = getPackage(packageId);
  if (!pkg) return 0;
  let people: number | null = null;
  for (const c of pkg.components) {
    const item = items.find((i) => i.activityId === c.activityId);
    if (!item) return 0;
    if (people === null) people = item.qty;
    if (item.qty !== people) return 0;
    if (c.video && item.video !== item.qty) return 0;
  }
  const extra = items.filter((i) => !pkg.components.some((c) => c.activityId === i.activityId));
  if (extra.length) return 0;
  return people ?? 0;
}

/** The cart a package books for `people` jumpers. */
export function itemsForPackage(packageId: PackageId, people: number, times: Partial<Record<ActivityId, Hm>> = {}): CartItem[] {
  const pkg = getPackage(packageId);
  if (!pkg) return [];
  return pkg.components.map((c) => ({
    activityId: c.activityId,
    qty: people,
    time: times[c.activityId] ?? '',
    video: c.video ? people : 0,
    photos: 0,
  }));
}

function clampInt(n: number, min: number, max: number) {
  const v = Math.floor(Number.isFinite(n) ? n : 0);
  return Math.min(max, Math.max(min, v));
}

// ---------- Slots ----------

export type Slot = {
  time: Hm;
  capacity: number;
  remaining: number;
  /** Within the last hour before sunset. */
  goldenHour: boolean;
  closed: boolean;
};

/** Capacity units each activity's slot can sell online. */
export function onlineCapacity(a: Activity, cfg: CapacityConfig): number {
  if (a.booking.mode === 'session') return 1;
  if (a.booking.mode !== 'slots') return 0;
  return Math.max(1, Math.floor(cfg.perSlot[a.booking.resource] * cfg.onlineShare));
}

export function slotTimes(a: Activity, day: DayHours, cfg: CapacityConfig): Hm[] {
  if (!day.open || !day.opensAt || !day.lastStart) return [];
  const start = hmToMinutes(day.opensAt);
  if (a.booking.mode === 'slots') {
    const last = hmToMinutes(day.lastStart);
    const out: Hm[] = [];
    for (let m = start; m <= last; m += cfg.slotMinutes) out.push(minutesToHm(m));
    return out;
  }
  if (a.booking.mode === 'session') {
    if (!a.booking.weekdays.includes(weekday(day.date))) return [];
    const endBy = hmToMinutes(day.sunset) - a.booking.minutes;
    const out: Hm[] = [];
    for (let m = start; m <= endBy; m += 60) out.push(minutesToHm(m));
    return out;
  }
  return [];
}

/**
 * Slots for a day with what is left, given units already taken per start time.
 * `now` is the current SAST date and minutes since midnight.
 */
export function buildSlots(a: Activity, day: DayHours, cfg: CapacityConfig, used: Record<Hm, number>, now: { date: Ymd; minutes: number }): Slot[] {
  const capacity = onlineCapacity(a, cfg);
  const sunset = hmToMinutes(day.sunset);
  const lead = a.booking.mode === 'session' ? a.booking.leadHours * 60 : cfg.cutoffMinutes;
  return slotTimes(a, day, cfg).map((time) => {
    const t = hmToMinutes(time);
    const minutesAhead = dayDiffMinutes(now, day.date, t);
    const remaining = Math.max(0, capacity - (used[time] ?? 0));
    return {
      time,
      capacity,
      remaining,
      goldenHour: sunset - t <= 60,
      closed: minutesAhead < lead,
    };
  });
}

function dayDiffMinutes(now: { date: Ymd; minutes: number }, date: Ymd, minutes: number): number {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${now.date}T12:00:00Z`)) / 86_400_000);
  return days * 1440 + minutes - now.minutes;
}

/** Units a booking line needs from its slot. */
export function unitsNeeded(a: Activity, qty: number): number {
  if (a.booking.mode === 'session') return 1;
  if (a.booking.mode === 'slots') return a.booking.unitsPerPerson * qty;
  return 0;
}

// ---------- Safety rules ----------

export type ParticipantInput = {
  name: string;
  weightKg: number | null;
  minor: boolean;
};

export type SafetyInput = {
  participants: ParticipantInput[];
  allTwelvePlus: boolean;
  medicalOk: boolean;
  guardianName: string;
};

/** Weight, age and consent checks, run before payment and again on the bridge. */
export function safetyErrors(activitiesBooked: Activity[], input: SafetyInput): string[] {
  const errors: string[] = [];
  const needWeight = activitiesBooked.filter((a) => a.rules.minWeightKg || a.rules.maxWeightKg);
  input.participants.forEach((p, i) => {
    const who = p.name.trim() || `Person ${i + 1}`;
    if (!p.name.trim()) errors.push(`Add a first name for person ${i + 1}.`);
    for (const a of needWeight) {
      if (p.weightKg == null || !Number.isFinite(p.weightKg)) {
        errors.push(`Add ${who}’s weight in kg. ${a.name} needs it for the right cord and harness.`);
        break;
      }
      const min = a.rules.minWeightKg ?? 0;
      const max = a.rules.maxWeightKg ?? 999;
      if (p.weightKg < min || p.weightKg > max) {
        errors.push(`${who}: ${a.name} is for ${min}–${max} kg.`);
      }
    }
  });
  if (activitiesBooked.some((a) => a.rules.minAge) && !input.allTwelvePlus) {
    errors.push('Everyone going up the tower must be 12 or older.');
  }
  if (input.participants.some((p) => p.minor) && input.guardianName.trim().length < 3) {
    errors.push('Under-18s need a parent or guardian’s consent: add their full name.');
  }
  if (activitiesBooked.some((a) => a.rules.medicalExclusions) && !input.medicalOk) {
    errors.push('Please confirm nobody taking part has any of the listed medical conditions.');
  }
  return errors;
}
