import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { HomeLayout } from '@/core/home/composeHome';
import type { NotificationCategory, Role } from '@/core/domain/models';

/**
 * Personal, non-sensitive preferences: Home layout, notification settings,
 * saved events and recent searches. Persisted in AsyncStorage, keyed by user
 * so a shared device does not mix two people's settings.
 */

export interface NotificationPrefs {
  muted: NotificationCategory[];
  quietHours: { enabled: boolean; start: number; end: number };
}

const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  muted: [],
  quietHours: { enabled: true, start: 22 * 60, end: 6 * 60 },
};

interface UserPrefs {
  homeLayouts: Partial<Record<Role, HomeLayout>>;
  notifications: NotificationPrefs;
  savedEvents: string[];
  recentSearches: string[];
}

const emptyPrefs = (): UserPrefs => ({
  homeLayouts: {},
  notifications: DEFAULT_NOTIFICATION_PREFS,
  savedEvents: [],
  recentSearches: [],
});

interface PreferencesState {
  byUser: Record<string, UserPrefs>;
  update(userId: string, fn: (p: UserPrefs) => UserPrefs): void;
}

export const usePreferencesStore = create<PreferencesState>()(
  persist(
    (set) => ({
      byUser: {},
      update: (userId, fn) =>
        set((s) => ({ byUser: { ...s.byUser, [userId]: fn(s.byUser[userId] ?? emptyPrefs()) } })),
    }),
    {
      name: 'nmu-one.preferences.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ byUser: s.byUser }),
    },
  ),
);

export const prefsFor = (userId: string | undefined): UserPrefs =>
  (userId ? usePreferencesStore.getState().byUser[userId] : undefined) ?? emptyPrefs();

export function usePrefs(userId: string | undefined): UserPrefs {
  return usePreferencesStore((s) => (userId ? s.byUser[userId] : undefined)) ?? EMPTY;
}

const EMPTY = emptyPrefs();

export const preferences = {
  setHomeLayout(userId: string, role: Role, layout: HomeLayout) {
    usePreferencesStore
      .getState()
      .update(userId, (p) => ({ ...p, homeLayouts: { ...p.homeLayouts, [role]: layout } }));
  },
  resetHomeLayout(userId: string, role: Role) {
    usePreferencesStore.getState().update(userId, (p) => {
      const next = { ...p.homeLayouts };
      delete next[role];
      return { ...p, homeLayouts: next };
    });
  },
  setNotificationPrefs(userId: string, prefs: NotificationPrefs) {
    usePreferencesStore.getState().update(userId, (p) => ({ ...p, notifications: prefs }));
  },
  toggleSavedEvent(userId: string, eventId: string) {
    usePreferencesStore.getState().update(userId, (p) => ({
      ...p,
      savedEvents: p.savedEvents.includes(eventId)
        ? p.savedEvents.filter((e) => e !== eventId)
        : [eventId, ...p.savedEvents],
    }));
  },
  addRecentSearch(userId: string, query: string) {
    const q = query.trim();
    if (!q) return;
    usePreferencesStore.getState().update(userId, (p) => ({
      ...p,
      recentSearches: [q, ...p.recentSearches.filter((r) => r !== q)].slice(0, 6),
    }));
  },
  clearRecentSearches(userId: string) {
    usePreferencesStore.getState().update(userId, (p) => ({ ...p, recentSearches: [] }));
  },
};
