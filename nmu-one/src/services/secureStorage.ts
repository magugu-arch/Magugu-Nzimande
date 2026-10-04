import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Encrypted storage for tokens and sensitive session state (brief §24).
 *
 * iOS and Android use the Keychain / Keystore through expo-secure-store. The
 * browser has no equivalent, so the web build keeps the session for the
 * life of the tab only (sessionStorage) and never in localStorage.
 */
const web = {
  get(key: string): string | null {
    try {
      return globalThis.sessionStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  },
  set(key: string, value: string) {
    try {
      globalThis.sessionStorage?.setItem(key, value);
    } catch {
      // Private mode or storage disabled: the session simply won't survive a reload.
    }
  },
  remove(key: string) {
    try {
      globalThis.sessionStorage?.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  },
};

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return web.get(key);
    try {
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return web.set(key, value);
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') return web.remove(key);
    try {
      await SecureStore.deleteItemAsync(key);
    } catch {
      // Already gone.
    }
  },
};
