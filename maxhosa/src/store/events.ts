import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

/**
 * Device-side event state. RSVPs themselves belong to the events provider;
 * this only remembers which day-before reminders the customer switched on
 * (a device preference) and bumps a revision so screens re-read the
 * provider after an RSVP changes.
 */
type EventsState = {
  revision: number;
  reminders: Record<string, boolean>;
  bump: () => void;
  toggleReminder: (eventId: string) => void;
};

export const useEventsState = create<EventsState>()(
  persist(
    (set) => ({
      revision: 0,
      reminders: {},
      bump: () => set((s) => ({ revision: s.revision + 1 })),
      toggleReminder: (eventId) =>
        set((s) => ({ reminders: { ...s.reminders, [eventId]: !s.reminders[eventId] } })),
    }),
    {
      name: 'mx.events',
      storage: persistStorage,
      partialize: (s) => ({ reminders: s.reminders }),
    },
  ),
);
