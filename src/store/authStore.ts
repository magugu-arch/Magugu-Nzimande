import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AppPreferences, AuthSession, NotificationPreferences, UserProfile } from '@/types';
import { createGuestUser, signOut as signOutService } from '@/services/authService';
import { pullFavourites } from '@/features/favourites/sync';
import { identify } from '@/ux/analytics';
import { useFavouritesStore } from './favouritesStore';

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
  /**
   * Drop the session without telling the server. For an expired session,
   * where the sign-out call would only 401 again and the tokens have already
   * been cleared by the API client.
   */
  signOutLocally: () => void;
  completeOnboarding: () => void;
  setNotificationPreference: <K extends keyof NotificationPreferences>(
    key: K,
    value: NotificationPreferences[K],
  ) => void;
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
}

/**
 * What is left of a person once they sign out.
 *
 * The preferences go with them. They are this customer's answers, not the
 * handset's — and `marketingConsent` in particular is a consent record: under
 * POPIA it belongs to the person who gave it, and handing it to whoever signs
 * in next is not a tidiness problem.
 *
 * `hasCompletedOnboarding` deliberately stays. Whether the welcome screens
 * have been seen is a fact about the phone, and making the next person sit
 * through them again would be a worse app for no gain.
 */
const FORGOTTEN = {
  user: null,
  isAuthenticated: false,
  isGuest: false,
  notificationPreferences: DEFAULT_NOTIFICATIONS,
  preferences: DEFAULT_PREFERENCES,
} as const;

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isGuest: false,
      hasCompletedOnboarding: false,
      notificationPreferences: DEFAULT_NOTIFICATIONS,
      preferences: DEFAULT_PREFERENCES,

      setSession: (session) => {
        // Here rather than in the two screens that call this, for the reason
        // sign-out is centralised: signing in and registering are separate
        // code paths that have already drifted apart once in this app.
        //
        // Favourites are local and outlive a sign-out on purpose, so that
        // signing out to browse does not take them away. Nothing asked whose
        // they were, though, so the next person to sign in on this handset
        // inherited a stranger's hearted dishes — under a Favourites tab that
        // presents them as their own.
        useFavouritesStore.getState().claimFor(session.user.isGuest ? null : session.user.id);

        // And now that the list is known to be theirs, merge in whatever the
        // account already had — a heart given on another handset. Deliberately
        // not awaited: signing in must not wait on it, and `pullFavourites`
        // never throws, so there is nothing here to catch. A guest has no
        // account to merge from.
        if (!session.user.isGuest) void pullFavourites();

        // Tie subsequent events to the account — or explicitly to nobody for a
        // guest, so their browsing is not filed under whoever was signed in on
        // this handset last.
        identify(session.user.isGuest ? null : session.user.id);

        set({ user: session.user, isAuthenticated: true, isGuest: session.user.isGuest });
      },

      setUser: (user) => set({ user }),

      continueAsGuest: () =>
        set({ user: createGuestUser(), isAuthenticated: false, isGuest: true }),

      signOut: async () => {
        await signOutService();
        identify(null);
        set(FORGOTTEN);
      },

      signOutLocally: () => {
        identify(null);
        set(FORGOTTEN);
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
