import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { persistStorage } from './storage';

interface MatchdayState {
  /** Checklist items ticked, by fixture. */
  done: Record<string, string[]>;
  /** Chosen meeting point id, by fixture. */
  meetingPoint: Record<string, string>;
  toggle: (fixtureId: string, itemId: string) => void;
  setMeetingPoint: (fixtureId: string, pointId: string | null) => void;
}

export const useMatchdayPlan = create<MatchdayState>()(
  persist(
    (set) => ({
      done: {},
      meetingPoint: {},
      toggle: (fixtureId, itemId) =>
        set((state) => {
          const current = state.done[fixtureId] ?? [];
          const next = current.includes(itemId)
            ? current.filter((id) => id !== itemId)
            : [...current, itemId];
          return { done: { ...state.done, [fixtureId]: next } };
        }),
      setMeetingPoint: (fixtureId, pointId) =>
        set((state) => {
          const next = { ...state.meetingPoint };
          if (pointId) next[fixtureId] = pointId;
          else delete next[fixtureId];
          return { meetingPoint: next };
        }),
    }),
    { name: 'scarlets:matchday', storage: persistStorage },
  ),
);
