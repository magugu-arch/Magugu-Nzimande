import type { ActivityId, Resource } from '@/content/catalog';
import type { HoursOverride } from '@/lib/hours';

/**
 * Operating settings staff can change in the console without a deploy.
 * Capacities are starting points to confirm with the jump masters.
 */
export type CapacityConfig = {
  /** Length of a timed slot. */
  slotMinutes: number;
  /** Share of each slot sold online; the rest stays for walk-ins (relaunch plan: 70/30). */
  onlineShare: number;
  /** Capacity units per slot, before the online share is applied. */
  perSlot: Record<Resource, number>;
  /** How far ahead the calendar opens. */
  horizonDays: number;
  /** Same-day bookings close this many minutes before a slot. */
  cutoffMinutes: number;
  /** Unpaid bookings release their places after this long. */
  holdMinutes: number;
};

export const defaultCapacity: CapacityConfig = {
  slotMinutes: 30,
  onlineShare: 0.7,
  perSlot: { bridge: 6, scad: 6, zipline: 8, lift: 10, arena: 1 },
  horizonDays: 120,
  cutoffMinutes: 30,
  holdMinutes: 15,
};

export type PriceOverride = { price?: number; groupPrice?: number; disabled?: boolean };
export type PriceOverrides = Partial<Record<ActivityId, PriceOverride>>;

export type SettingsShape = {
  tower_status: import('@/lib/status-types').TowerStatus;
  capacity: CapacityConfig;
  price_overrides: PriceOverrides;
  hours_overrides: HoursOverride[];
};

export const SETTINGS_DEFAULTS: SettingsShape = {
  tower_status: { state: 'auto', note: null, queueMinutes: null, updatedAt: new Date(0).toISOString() },
  capacity: defaultCapacity,
  price_overrides: {},
  hours_overrides: [],
};
