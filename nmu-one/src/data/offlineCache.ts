import AsyncStorage from '@react-native-async-storage/async-storage';
import type { QueryKey } from '@tanstack/react-query';
import { clock } from '@/core/time/clock';
import { offlinePolicyFor } from '@/core/offline/policy';

/**
 * The offline copy of cacheable queries (core/offline/policy.ts). Writes are
 * refused for anything the policy marks 'never', so a caller cannot cache a
 * balance by mistake.
 */
export interface CacheEntry<T> {
  data: T;
  savedAt: string;
}

const PREFIX = 'nmu-one.offline.v1:';
const keyFor = (key: QueryKey) => `${PREFIX}${JSON.stringify(key)}`;

export const offlineCache = {
  async write<T>(key: QueryKey, data: T): Promise<void> {
    if (offlinePolicyFor(key) !== 'cache') return;
    try {
      await AsyncStorage.setItem(
        keyFor(key),
        JSON.stringify({ data, savedAt: clock.now().toISOString() } satisfies CacheEntry<T>),
      );
    } catch {
      // A full disk loses the offline copy, not the screen.
    }
  },

  async read<T>(key: QueryKey): Promise<CacheEntry<T> | null> {
    if (offlinePolicyFor(key) !== 'cache') return null;
    try {
      const raw = await AsyncStorage.getItem(keyFor(key));
      return raw ? (JSON.parse(raw) as CacheEntry<T>) : null;
    } catch {
      return null;
    }
  },

  /** Removes one person's offline copies, on sign-out. */
  async clearFor(userId: string): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const mine = keys.filter((k) => k.startsWith(PREFIX) && k.includes(JSON.stringify(userId)));
      if (mine.length) await AsyncStorage.multiRemove(mine);
    } catch {
      // Best effort.
    }
  },
};
