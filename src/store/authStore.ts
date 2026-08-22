import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppPreferences, AuthSession, NotificationPreferences, UserProfile } from '@/types';
import { createGuestUser, signOut as signOutService } from '@/services/authService';

/**
 * Session and preference state.
 *
 * Tokens are NOT persisted here — they live in the keychain via secureStorage.
 * This store only keeps the profile and preferences needed to render the UI.
 */

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  orderUpdates: true,
  promotions: true,
  rewards: true,
  newProducts: false,
  channelPush: true,
  channelEmail: true,
  channelSms: false,
};

const DEFAULT_PREFERENCES: AppPreferences = {
  defaultFulfilment: 'delivery',
  marketingConsent: false,
  preferMildFirst: false,
};

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
  /** False until onboarding has been seen once. */
  hasCompletedOnboarding: boolean;
  notificationPreferences: NotificationPreferences;
  preferences: AppPreferences;

  setSession: (session: AuthSession) => void;
  setUser: (user: UserProfile) => void;
  continueAsGuest: () => void;
  signOut: () => Promise<void>;
  completeOnboarding: () => void;
  setNotificationPreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => void;
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isGuest: false,
      hasCompletedOnboarding: false,
      notificationPreferences: DEFAULT_NOTIFICATIONS,
      preferences: DEFAULT_PREFERENCES,

      setSession: (session) =>
        set({ user: session.user, isAuthenticated: true, isGuest: session.user.isGuest }),

      setUser: (user) => set({ user }),

      continueAsGuest: () =>
        set({ user: createGuestUser(), isAuthenticated: false, isGuest: true }),

      signOut: async () => {
        await signOutService();
        set({ user: null, isAuthenticated: false, isGuest: false });
      },

      completeOnboarding: () => set({ hasCompletedOnboarding: true }),

      setNotificationPreference: (key, value) =>
        set((state) => ({
          notificationPreferences: { ...state.notificationPreferences, [key]: value },
        })),

      setPreference: (key, value) =>
        set((state) => ({ preferences: { ...state.preferences, [key]: value } })),
    }),
    {
      name: 'bbq.auth',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        isGuest: state.isGuest,
        hasCompletedOnboarding: state.hasCompletedOnboarding,
        notificationPreferences: state.notificationPreferences,
        preferences: state.preferences,
      }),
    },
  ),
);

/** Greeting used on Home. Time-aware and name-aware (brief §11). */
export function greetingFor(user: UserProfile | null, now: Date = new Date()): string {
  const hour = now.getHours();
  const period = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (!user || user.isGuest || user.firstName.length === 0) return period;
  return `${period}, ${user.firstName}`;
}
