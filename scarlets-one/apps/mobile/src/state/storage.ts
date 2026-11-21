import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from '@scarlets/adapters';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * Device storage can be refused: a browser with site data blocked, or the app
 * opened as a file from a messaging app. The app must still start, so anything
 * storage refuses is kept in memory for the session instead.
 */
const memory = new Map<string, string>();

export const safeStorage: StateStorage = {
  getItem: async (key) => {
    try {
      const value = await AsyncStorage.getItem(key);
      return value ?? memory.get(key) ?? null;
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: async (key, value) => {
    memory.set(key, value);
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // Kept in memory above.
    }
  },
  removeItem: async (key) => {
    memory.delete(key);
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Nothing stored to remove.
    }
  },
};

/** Preferences and demo state stay on the device. Nothing here is sent anywhere. */
export const persistStorage = createJSONStorage(() => safeStorage);

export const keyValueStore: KeyValueStore = {
  get: (key) => safeStorage.getItem(`scarlets:${key}`) as Promise<string | null>,
  set: async (key, value) => {
    await safeStorage.setItem(`scarlets:${key}`, value);
  },
};
