import AsyncStorage from '@react-native-async-storage/async-storage';
import type { KeyValueStore } from '@scarlets/adapters';
import { createJSONStorage } from 'zustand/middleware';

/** Preferences and demo state stay on the device. Nothing here is sent anywhere. */
export const persistStorage = createJSONStorage(() => AsyncStorage);

export const keyValueStore: KeyValueStore = {
  get: (key) => AsyncStorage.getItem(`scarlets:${key}`),
  set: (key, value) => AsyncStorage.setItem(`scarlets:${key}`, value),
};
