import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * Storage split by sensitivity (brief §12 — secure storage).
 *
 * Tokens go to the platform keychain/keystore via expo-secure-store. Ordinary
 * preferences go to AsyncStorage. On web SecureStore is unavailable, so we fall
 * back to AsyncStorage and say so plainly rather than pretending it is secure.
 */

const ACCESS_TOKEN_KEY = 'bbq.auth.accessToken';
const REFRESH_TOKEN_KEY = 'bbq.auth.refreshToken';

const secureAvailable = Platform.OS !== 'web';

async function secureGet(key: string): Promise<string | null> {
  if (!secureAvailable) return AsyncStorage.getItem(key);
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function secureSet(key: string, value: string): Promise<void> {
  if (!secureAvailable) {
    await AsyncStorage.setItem(key, value);
    return;
  }
  try {
    await SecureStore.setItemAsync(key, value);
  } catch {
    // Keychain unavailable (locked device, simulator quirk). The caller stays
    // signed in for this session; the next launch will ask again.
  }
}

async function secureDelete(key: string): Promise<void> {
  if (!secureAvailable) {
    await AsyncStorage.removeItem(key);
    return;
  }
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Nothing to clear.
  }
}

export function getAccessToken(): Promise<string | null> {
  return secureGet(ACCESS_TOKEN_KEY);
}

export function getRefreshToken(): Promise<string | null> {
  return secureGet(REFRESH_TOKEN_KEY);
}

export async function storeTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    secureSet(ACCESS_TOKEN_KEY, accessToken),
    secureSet(REFRESH_TOKEN_KEY, refreshToken),
  ]);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([secureDelete(ACCESS_TOKEN_KEY), secureDelete(REFRESH_TOKEN_KEY)]);
}

/** Non-sensitive key/value persistence for preferences and cached snapshots. */
export const preferenceStorage = {
  async get<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — preferences fall back to defaults.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // Nothing to clear.
    }
  },
};
