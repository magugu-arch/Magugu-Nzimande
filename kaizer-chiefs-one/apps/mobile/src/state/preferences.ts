import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  defaultNotificationPreferences,
  defaultPrivacySettings,
  type NotificationCategory,
  type NotificationPreferences,
  type PrivacySettings,
} from '@kc-one/contracts';
import { plainStorage } from './storage';

interface PreferencesState {
  privacy: PrivacySettings;
  notifications: NotificationPreferences;
  readNotificationIds: string[];
  savedIds: string[];
  toggleSaved: (id: string) => void;
  setPrivacy: (patch: Partial<PrivacySettings>) => void;
  setPush: (enabled: boolean) => void;
  setCategory: (c: NotificationCategory, on: boolean) => void;
  markRead: (id: string) => void;
  markAllRead: (ids: string[]) => void;
  resetAll: () => void;
}

/**
 * Supporter choices. Everything optional starts off. In live mode these are
 * mirrored to the profile and notification_preferences tables.
 */
export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      privacy: defaultPrivacySettings(),
      notifications: defaultNotificationPreferences(),
      readNotificationIds: [],
      savedIds: [],
      toggleSaved: (id) =>
        set((s) => ({
          savedIds: s.savedIds.includes(id)
            ? s.savedIds.filter((x) => x !== id)
            : [id, ...s.savedIds],
        })),
      setPrivacy: (patch) => set((s) => ({ privacy: { ...s.privacy, ...patch } })),
      setPush: (pushEnabled) =>
        set((s) => ({ notifications: { ...s.notifications, pushEnabled } })),
      setCategory: (c, on) =>
        set((s) =>
          c === 'account'
            ? s
            : {
                notifications: {
                  ...s.notifications,
                  categories: { ...s.notifications.categories, [c]: on },
                },
              },
        ),
      markRead: (id) =>
        set((s) =>
          s.readNotificationIds.includes(id)
            ? s
            : { readNotificationIds: [...s.readNotificationIds, id] },
        ),
      markAllRead: (ids) =>
        set((s) => ({
          readNotificationIds: Array.from(new Set([...s.readNotificationIds, ...ids])),
        })),
      resetAll: () =>
        set({
          privacy: defaultPrivacySettings(),
          notifications: defaultNotificationPreferences(),
          readNotificationIds: [],
          savedIds: [],
        }),
    }),
    { name: 'kc1.preferences', storage: plainStorage },
  ),
);
