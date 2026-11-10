import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { createJSONStorage, type StateStorage } from 'zustand/middleware';

/**
 * Sensitive values (the session) live in the platform keychain/keystore.
 * expo-secure-store has no web implementation, so the browser preview falls
 * back to AsyncStorage; web is a preview target only, not a release target.
 */
const secure: StateStorage = {
  getItem: (k) => SecureStore.getItemAsync(k),
  setItem: (k, v) => SecureStore.setItemAsync(k, v),
  removeItem: (k) => SecureStore.deleteItemAsync(k),
};

export const secureStorage = createJSONStorage(() =>
  Platform.OS === 'web' ? AsyncStorage : secure,
);

export const plainStorage = createJSONStorage(() => AsyncStorage);
