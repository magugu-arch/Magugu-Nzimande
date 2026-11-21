import type { ContentCategory, Locale } from '@scarlets/domain';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

export type ThemePreference = 'system' | 'light' | 'dark';

/** Topics a supporter can follow. Chosen by them, never inferred. */
export const followable: ContentCategory[] = [
  'first_team',
  'women',
  'academy',
  'community',
  'history',
];

interface PrefsState {
  hydrated: boolean;
  onboarded: boolean;
  /** Null until chosen: the first run offers the device language. */
  locale: Locale | null;
  theme: ThemePreference;
  following: ContentCategory[];
  /** Extra to the system setting, so it can be tried without leaving the app. */
  reduceMotion: boolean;
  /** Random id for this install. One-vote-per-device rules use it for guests. */
  deviceId: string;
  setLocale: (locale: Locale) => void;
  setTheme: (theme: ThemePreference) => void;
  toggleFollowing: (category: ContentCategory) => void;
  setReduceMotion: (value: boolean) => void;
  completeOnboarding: () => void;
  reset: () => void;
}

const newDeviceId = () =>
  `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      hydrated: false,
      onboarded: false,
      locale: null,
      theme: 'system',
      following: ['first_team'],
      reduceMotion: false,
      deviceId: newDeviceId(),
      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      toggleFollowing: (category) =>
        set((state) => ({
          following: state.following.includes(category)
            ? state.following.filter((c) => c !== category)
            : [...state.following, category],
        })),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      completeOnboarding: () => set({ onboarded: true }),
      reset: () =>
        set({
          onboarded: false,
          locale: null,
          theme: 'system',
          following: ['first_team'],
          reduceMotion: false,
        }),
    }),
    {
      name: 'scarlets:prefs',
      storage: persistStorage,
      partialize: ({ onboarded, locale, theme, following, reduceMotion, deviceId }) => ({
        onboarded,
        locale,
        theme,
        following,
        reduceMotion,
        deviceId,
      }),
      onRehydrateStorage: () => () => {
        usePrefs.setState({ hydrated: true });
      },
    },
  ),
);
