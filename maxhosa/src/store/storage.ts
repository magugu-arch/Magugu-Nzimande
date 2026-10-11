import AsyncStorage from '@react-native-async-storage/async-storage';
import { createJSONStorage } from 'zustand/middleware';

/**
 * Non-sensitive preferences only: bag, saved pieces, market, appearance.
 * Tokens and anything personal belong in Keychain/Keystore (expo-secure-store)
 * once accounts are connected — never here.
 */
export const persistStorage = createJSONStorage(() => AsyncStorage);
