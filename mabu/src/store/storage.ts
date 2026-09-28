import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Device storage for persisted stores. The web build renders each page to
 * HTML at build time, in Node, where there is no browser storage: there the
 * store simply starts empty rather than reaching for `window`.
 */
const memory = new Map<string, string>();

export const deviceStorage = createJSONStorage(() =>
  typeof window === 'undefined'
    ? {
        getItem: async (k: string) => memory.get(k) ?? null,
        setItem: async (k: string, v: string) => void memory.set(k, v),
        removeItem: async (k: string) => void memory.delete(k),
      }
    : AsyncStorage,
);
