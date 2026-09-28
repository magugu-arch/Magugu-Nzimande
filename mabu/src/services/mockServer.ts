import AsyncStorage from '@react-native-async-storage/async-storage';
import { createBackend, seedConfiguration, type Backend } from '@/domain/backend';
import { Database } from '@/domain/db';
import type { Actor } from '@/domain/guests/types';
import type { OutboxEntry } from '@/domain/notifications/providers';
import { createHandlers, type Handlers, type RpcName } from '@/domain/rpc';
import { config } from './config';
import { seedDemo } from './demoSeed';

/**
 * The mock back end: the real service layer, in-process, with its database
 * snapshotted to device storage so bookings survive a restart. It stands in
 * for the server until one is deployed (EXPO_PUBLIC_USE_MOCK_API=0).
 */
// Bumped when seed content changes, so demo installs pick it up.
const STORAGE_KEY = 'mabu.mockdb.v3';

let ready: Promise<{ backend: Backend; handlers: Handlers }> | null = null;
const pushListeners = new Set<(entry: OutboxEntry) => void>();

async function boot() {
  const db = new Database();
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) db.restore(JSON.parse(raw) as Record<string, unknown[]>);
  } catch {
    // Unreadable storage: start clean rather than fail to open.
  }
  const backend = createBackend({ db, flags: config.mockFlags, mode: 'mock' });
  seedConfiguration(backend);
  await seedDemo(backend);
  backend.channels.push.onSend = (entry) => pushListeners.forEach((l) => l(entry));
  await backend.runJobs();
  await save(backend);
  return { backend, handlers: createHandlers(backend) };
}

/**
 * Written after every call, not debounced: a debounce that every read resets
 * can starve the write, and a reload straight after booking then loses the
 * booking. The snapshot is tens of kilobytes; writing it is cheap.
 */
async function save(backend: Backend): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(backend.db.snapshot()));
  } catch {
    // Storage full or unavailable: the session carries on in memory.
  }
}

export function mockBackend() {
  ready ??= boot();
  return ready;
}

/** A believable network pause, so loading states are real in the demo. */
const latency = () => new Promise((r) => setTimeout(r, 120 + Math.random() * 180));

export async function mockCall(
  name: RpcName,
  args: unknown,
  actor: Actor | null,
): Promise<unknown> {
  const { backend, handlers } = await mockBackend();
  await latency();
  const handler = handlers[name] as (actor: Actor | null, args: unknown) => Promise<unknown>;
  try {
    return await handler(actor, args);
  } finally {
    await save(backend);
  }
}

/** Runs the server's scheduled jobs; the app calls this on focus and on a timer. */
export async function mockTick(): Promise<void> {
  const { backend } = await mockBackend();
  await backend.runJobs();
  await save(backend);
}

export function onMockPush(listener: (entry: OutboxEntry) => void): () => void {
  pushListeners.add(listener);
  return () => pushListeners.delete(listener);
}

export async function resetMockData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
  ready = null;
  await mockBackend();
}

export async function trackOnMock(
  event: Parameters<Backend['ctx']['analytics']['track']>[0],
  props?: Record<string, string | number | boolean | undefined>,
) {
  const { backend } = await mockBackend();
  backend.ctx.analytics.track(event, props);
}
