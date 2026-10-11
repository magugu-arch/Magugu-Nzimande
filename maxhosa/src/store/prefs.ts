import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { MarketId, NotificationPreference } from '@/domain/types';
import { persistStorage } from './storage';

type NotificationKey = NotificationPreference['key'];

type PrefsState = {
  market: MarketId;
  appearance: 'system' | 'light' | 'dark';
  sizes: string[];
  notifications: Record<NotificationKey, { enabled: boolean; consentedAt?: string }>;
  setMarket: (market: MarketId) => void;
  setAppearance: (appearance: PrefsState['appearance']) => void;
  toggleSize: (size: string) => void;
  setNotification: (key: NotificationKey, enabled: boolean) => void;
};

export const NOTIFICATION_KINDS: Record<NotificationKey, NotificationPreference['kind']> = {
  orders: 'transactional',
  restock: 'requested',
  collections: 'marketing',
};

export const usePrefs = create<PrefsState>()(
  persist(
    (set) => ({
      market: 'ZA',
      appearance: 'system',
      sizes: [],
      // Everything starts off. Each one is switched on by the customer after
      // being told what it is for, and consent is recorded per kind.
      notifications: {
        orders: { enabled: false },
        restock: { enabled: false },
        collections: { enabled: false },
      },
      setMarket: (market) => set({ market }),
      setAppearance: (appearance) => set({ appearance }),
      toggleSize: (size) =>
        set((s) => ({
          sizes: s.sizes.includes(size) ? s.sizes.filter((x) => x !== size) : [...s.sizes, size],
        })),
      setNotification: (key, enabled) =>
        set((s) => ({
          notifications: {
            ...s.notifications,
            [key]: { enabled, consentedAt: enabled ? new Date().toISOString() : undefined },
          },
        })),
    }),
    { name: 'mx.prefs', storage: persistStorage },
  ),
);
