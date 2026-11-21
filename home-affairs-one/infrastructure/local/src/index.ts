/**
 * Local platform for the prototype.
 *
 * The prototype has no servers. Everything a real deployment would get from
 * infrastructure — durable storage, a clock, identifier generation and an event
 * bus — is provided here, in the browser, on the person's own device. Nothing
 * is sent anywhere.
 *
 * `infrastructure/dev`, `staging` and `production` are intentionally empty:
 * those environments need DHA architecture, hosting and security decisions.
 */

/* ----------------------------- storage ----------------------------- */

/** The subset of the Web Storage API the platform needs. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
    key: (index) => [...map.keys()][index] ?? null,
    get length() {
      return map.size;
    },
  };
}

export interface KeyValueStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  remove(key: string): void;
  /** Remove every key in this platform's namespace. */
  clear(): void;
}

/* ------------------------------ events ----------------------------- */

export interface BusEvent<T = unknown> {
  topic: string;
  payload: T;
}
export type BusHandler = (event: BusEvent) => void;

export interface EventBus {
  publish<T>(topic: string, payload: T): void;
  /** Subscribe to one topic, or `'*'` for all. Returns an unsubscribe function. */
  subscribe(topic: string, handler: BusHandler): () => void;
}

/** Topics published by the mock services. */
export const TOPICS = {
  /** payload: CaseEvent */
  caseEvent: 'case.event',
  /** payload: { collection: string } — something in storage changed */
  storeChanged: 'store.changed',
  /** payload: GatewayCallRecord — one adapter call finished */
  gatewayCall: 'gateway.call',
} as const;

function createEventBus(): EventBus {
  const handlers = new Map<string, Set<BusHandler>>();
  return {
    publish(topic, payload) {
      const event: BusEvent = { topic, payload };
      for (const key of [topic, '*']) {
        for (const handler of [...(handlers.get(key) ?? [])]) handler(event);
      }
    },
    subscribe(topic, handler) {
      const set = handlers.get(topic) ?? new Set<BusHandler>();
      set.add(handler);
      handlers.set(topic, set);
      return () => void set.delete(handler);
    },
  };
}

/* ----------------------- simulated conditions ---------------------- */

/**
 * Lets a reviewer see every state the brief asks for (loading, offline, error,
 * retry) without a real outage.
 */
export type NetworkMode = 'normal' | 'slow' | 'offline' | 'error';

export interface PlatformSettings {
  network: NetworkMode;
  /** Base latency added to each adapter call, in milliseconds. */
  latencyMs: number;
}

const DEFAULT_SETTINGS: PlatformSettings = { network: 'normal', latencyMs: 220 };

/* ----------------------------- platform ---------------------------- */

export interface Platform {
  readonly store: KeyValueStore;
  readonly bus: EventBus;
  readonly clock: {
    now(): Date;
    /** ISO 8601 with a +02:00 offset (South African Standard Time). */
    iso(date?: Date): string;
  };
  readonly ids: {
    /** Next identifier for a prefix: `next('CASE-DEMO', 6)` → `CASE-DEMO-000042`. */
    next(prefix: string, pad?: number): string;
  };
  readonly settings: {
    get(): PlatformSettings;
    set(patch: Partial<PlatformSettings>): void;
  };
}

export interface PlatformOptions {
  /** Defaults to in-memory storage, which is what tests and server rendering get. */
  storage?: StorageLike;
  namespace?: string;
  now?: () => Date;
  settings?: Partial<PlatformSettings>;
}

/** Formats a date as local SAST time with an explicit +02:00 offset. */
export function toSastIso(date: Date): string {
  const shifted = new Date(date.getTime() + 2 * 60 * 60 * 1000);
  return `${shifted.toISOString().slice(0, 19)}+02:00`;
}

export function createLocalPlatform(options: PlatformOptions = {}): Platform {
  const storage = options.storage ?? createMemoryStorage();
  const namespace = options.namespace ?? 'hao.v1';
  const prefix = `${namespace}:`;
  const bus = createEventBus();
  const now = options.now ?? (() => new Date());

  const store: KeyValueStore = {
    get<T>(key: string) {
      const raw = storage.getItem(prefix + key);
      if (raw === null) return undefined;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      try {
        storage.setItem(prefix + key, JSON.stringify(value));
      } catch {
        // Storage full or blocked: the prototype keeps working for this session.
      }
    },
    remove(key) {
      storage.removeItem(prefix + key);
    },
    clear() {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        if (key?.startsWith(prefix)) keys.push(key);
      }
      for (const key of keys) storage.removeItem(key);
    },
  };

  let settings: PlatformSettings = {
    ...DEFAULT_SETTINGS,
    ...(store.get<PlatformSettings>('platform.settings') ?? {}),
    ...options.settings,
  };

  return {
    store,
    bus,
    clock: { now, iso: (date) => toSastIso(date ?? now()) },
    ids: {
      next(idPrefix, pad = 4) {
        const counters = store.get<Record<string, number>>('platform.counters') ?? {};
        const value = (counters[idPrefix] ?? 1000) + 1;
        counters[idPrefix] = value;
        store.set('platform.counters', counters);
        return `${idPrefix}-${String(value).padStart(pad, '0')}`;
      },
    },
    settings: {
      get: () => settings,
      set(patch) {
        settings = { ...settings, ...patch };
        store.set('platform.settings', settings);
        bus.publish(TOPICS.storeChanged, { collection: 'platform.settings' });
      },
    },
  };
}

/* ---------------------------- collections -------------------------- */

export interface Collection<T> {
  all(): T[];
  get(id: string): T | undefined;
  find(predicate: (item: T) => boolean): T[];
  /** Insert or replace by id. */
  put(item: T): T;
  remove(id: string): void;
  replaceAll(items: T[]): void;
  /** True once the collection has been written at least once (including an empty seed). */
  exists(): boolean;
}

/**
 * A tiny document collection over the key-value store. Each mock service owns
 * its collections; nothing reads another service's data directly.
 */
export function createCollection<T>(
  platform: Platform,
  name: string,
  idOf: (item: T) => string,
): Collection<T> {
  const key = `col.${name}`;
  const read = () => platform.store.get<T[]>(key) ?? [];
  const write = (items: T[]) => {
    platform.store.set(key, items);
    platform.bus.publish(TOPICS.storeChanged, { collection: name });
  };
  return {
    all: read,
    get: (id) => read().find((item) => idOf(item) === id),
    find: (predicate) => read().filter(predicate),
    put(item) {
      const items = read();
      const index = items.findIndex((existing) => idOf(existing) === idOf(item));
      if (index >= 0) items[index] = item;
      else items.push(item);
      write(items);
      return item;
    },
    remove(id) {
      write(read().filter((item) => idOf(item) !== id));
    },
    replaceAll: write,
    exists: () => platform.store.get<T[]>(key) !== undefined,
  };
}

/** Milliseconds helpers for building seed data relative to "now". */
export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
