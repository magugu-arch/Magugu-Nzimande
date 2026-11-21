import { describe, expect, it, vi } from 'vitest';
import {
  TOPICS,
  createCollection,
  createLocalPlatform,
  createMemoryStorage,
  toSastIso,
} from './index';

const fixedNow = () => new Date('2026-11-21T08:40:00Z');

describe('local platform', () => {
  it('formats time as SAST with an explicit offset', () => {
    expect(toSastIso(fixedNow())).toBe('2026-11-21T10:40:00+02:00');
    expect(createLocalPlatform({ now: fixedNow }).clock.iso()).toBe('2026-11-21T10:40:00+02:00');
  });

  it('issues sequential, padded identifiers per prefix', () => {
    const platform = createLocalPlatform({ now: fixedNow });
    expect(platform.ids.next('CASE-DEMO', 6)).toBe('CASE-DEMO-001001');
    expect(platform.ids.next('CASE-DEMO', 6)).toBe('CASE-DEMO-001002');
    expect(platform.ids.next('PAY-DEMO')).toBe('PAY-DEMO-1001');
  });

  it('namespaces storage and clears only its own keys', () => {
    const storage = createMemoryStorage();
    storage.setItem('someone-else', 'keep');
    const platform = createLocalPlatform({ storage, namespace: 'test' });
    platform.store.set('a', { value: 1 });
    expect(platform.store.get<{ value: number }>('a')).toEqual({ value: 1 });
    platform.store.clear();
    expect(platform.store.get('a')).toBeUndefined();
    expect(storage.getItem('someone-else')).toBe('keep');
  });

  it('survives corrupt stored JSON', () => {
    const storage = createMemoryStorage();
    storage.setItem('test:a', '{not json');
    expect(createLocalPlatform({ storage, namespace: 'test' }).store.get('a')).toBeUndefined();
  });

  it('delivers events to topic and wildcard subscribers, and stops after unsubscribe', () => {
    const platform = createLocalPlatform();
    const onTopic = vi.fn();
    const onAll = vi.fn();
    const off = platform.bus.subscribe('case.event', onTopic);
    platform.bus.subscribe('*', onAll);
    platform.bus.publish('case.event', { id: 1 });
    off();
    platform.bus.publish('case.event', { id: 2 });
    expect(onTopic).toHaveBeenCalledTimes(1);
    expect(onAll).toHaveBeenCalledTimes(2);
  });

  it('persists simulated network settings', () => {
    const storage = createMemoryStorage();
    createLocalPlatform({ storage }).settings.set({ network: 'offline' });
    expect(createLocalPlatform({ storage }).settings.get().network).toBe('offline');
  });
});

describe('collections', () => {
  interface Item {
    id: string;
    n: number;
  }

  it('puts, replaces, finds and removes by id', () => {
    const platform = createLocalPlatform();
    const items = createCollection<Item>(platform, 'items', (item) => item.id);
    expect(items.exists()).toBe(false);
    items.put({ id: 'a', n: 1 });
    items.put({ id: 'b', n: 2 });
    items.put({ id: 'a', n: 3 });
    expect(items.exists()).toBe(true);
    expect(items.all()).toHaveLength(2);
    expect(items.get('a')?.n).toBe(3);
    expect(items.find((item) => item.n > 2)).toHaveLength(1);
    items.remove('a');
    expect(items.get('a')).toBeUndefined();
  });

  it('announces every write on the bus', () => {
    const platform = createLocalPlatform();
    const seen = vi.fn();
    platform.bus.subscribe(TOPICS.storeChanged, seen);
    createCollection<Item>(platform, 'items', (item) => item.id).put({ id: 'a', n: 1 });
    expect(seen).toHaveBeenCalledWith({
      topic: TOPICS.storeChanged,
      payload: { collection: 'items' },
    });
  });
});
