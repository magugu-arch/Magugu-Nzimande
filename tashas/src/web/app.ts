/**
 * The browser sandbox: one TashasSystem running on this device, its state
 * snapshotted to localStorage (best effort), and the per-device settings
 * (which guest profile is "you", attribution, measurement choice, staff role).
 *
 * Everything here is the clearly labelled demo path the brief allows. In a
 * deployed build the same screens talk to the API instead of an in-page
 * system; see docs/ARCHITECTURE.md.
 */

import { useEffect, useState } from 'preact/hooks';
import { content } from '../content/index.ts';
import { createTashasSystem } from '../domain/system.ts';
import type { TashasSystem } from '../domain/system.ts';
import { OffsetClock, createIdSource } from '../domain/util/core.ts';
import type { AttributionSnapshot, StaffRole } from '../domain/types.ts';
import { seedDemoPopulation, seedSampleGuest } from '../domain/seed.ts';

const DB_KEY = 'tashas-sandbox-db-v1';
const DEVICE_KEY = 'tashas-sandbox-device-v1';

export interface DeviceState {
  guestId: string;
  sessionId: string;
  attribution: AttributionSnapshot | null;
  measurement: boolean;
  role: StaffRole;
  clockOffsetMs: number;
  seededAt: number;
}

export const clock = new OffsetClock();
export const sys: TashasSystem = createTashasSystem({ content, clock, ids: createIdSource() });

let device: DeviceState = {
  guestId: '',
  sessionId: '',
  attribution: null,
  measurement: true,
  role: 'manager',
  clockOffsetMs: 0,
  seededAt: 0,
};

const deviceListeners = new Set<() => void>();

function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full, blocked or unavailable: the sandbox keeps working in memory */
  }
}

export function getDevice(): DeviceState {
  return device;
}

export function setDevice(patch: Partial<DeviceState>): void {
  device = { ...device, ...patch };
  if (patch.clockOffsetMs !== undefined) clock.offsetMs = patch.clockOffsetMs;
  sys.analytics.enabled = device.measurement;
  write(DEVICE_KEY, device);
  for (const l of deviceListeners) l();
}

let saveTimer = 0;
function scheduleSave(): void {
  if (saveTimer) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    const snapshot = sys.db.toJSON();
    // Analytics is the only unbounded table; keep the newest 600 events.
    snapshot.analytics = (snapshot.analytics ?? []).slice(-600);
    write(DB_KEY, snapshot);
  }, 500);
}

function newSession(): string {
  return sys.ctx.ids.id('ses');
}

/** Loads the saved sandbox or seeds a fresh one. */
export async function boot(): Promise<void> {
  const saved = read<Record<string, { id: string }[]>>(DB_KEY);
  const savedDevice = read<DeviceState>(DEVICE_KEY);
  if (saved && savedDevice?.guestId) {
    try {
      sys.db.load(saved);
      device = { ...device, ...savedDevice, sessionId: newSession() };
      clock.offsetMs = device.clockOffsetMs;
      if (!sys.db.get('guests', device.guestId)) throw new Error('profile missing');
    } catch {
      sys.reset();
      await seedFresh();
    }
  } else {
    await seedFresh();
  }
  sys.analytics.enabled = device.measurement;
  sys.db.subscribe(scheduleSave);
  write(DEVICE_KEY, device);
}

async function seedFresh(): Promise<void> {
  clock.offsetMs = 0;
  const guestId = await seedSampleGuest(sys);
  seedDemoPopulation(sys);
  await sys.settle();
  device = { ...device, guestId, sessionId: newSession(), clockOffsetMs: 0, seededAt: clock.now(), attribution: null };
}

export async function resetSandbox(): Promise<void> {
  sys.reset();
  await seedFresh();
  write(DEVICE_KEY, device);
  for (const l of deviceListeners) l();
}

/** Re-renders on any database or device change, batched to one frame. */
export function useStore(): { version: number; device: DeviceState } {
  const [, force] = useState(0);
  useEffect(() => {
    let frame = 0;
    const bump = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        force((n) => n + 1);
      });
    };
    const offDb = sys.db.subscribe(bump);
    deviceListeners.add(bump);
    return () => {
      offDb();
      deviceListeners.delete(bump);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
  return { version: sys.db.version, device };
}

export function track(name: string, props: Record<string, string | number | boolean | null> = {}): void {
  try {
    sys.analytics.track(name, props, device.sessionId, device.attribution?.lastTouch?.utm.campaign ?? null);
  } catch {
    /* measurement never blocks the guest */
  }
}

/** Runs queues until quiet; screens await this after an action. */
export async function settle(): Promise<void> {
  await sys.settle();
}

let pump = 0;
/** The sandbox's queue runner: delivers due webhooks, sends due messages. */
export function startPump(): void {
  if (pump) return;
  const run = async () => {
    try {
      await sys.settle(4);
    } catch (err) {
      console.error(err);
    }
    pump = window.setTimeout(run, 700);
  };
  pump = window.setTimeout(run, 700);
}

export function isArtifactViewer(): boolean {
  return typeof (window as unknown as { claude?: { use?: unknown } }).claude?.use === 'function';
}
