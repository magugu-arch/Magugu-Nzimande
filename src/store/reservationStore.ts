import { create } from 'zustand';
import type { ReservationDraft, ReservationOccasion, SeatingPreference } from '@/types/reservation';

/**
 * The reservation a guest is part-way through making.
 *
 * §7 asks for "progressive disclosure rather than a long single page", which
 * means the draft outlives any one screen. Holding it in a store rather than
 * threading it through route params keeps each step a plain screen that reads
 * and writes one or two fields, and means backing up a step does not lose
 * what was already chosen — which is the difference between a form and a
 * concierge.
 */

interface ReservationState {
  draft: ReservationDraft;
  /** Which step the guest has reached, 0-based. */
  step: number;
  setDate: (date: string) => void;
  setTime: (time: string) => void;
  setPartySize: (size: number) => void;
  setSeating: (seating: SeatingPreference) => void;
  setOccasion: (occasion: ReservationOccasion) => void;
  setNotes: (notes: string) => void;
  setDetails: (
    details: Pick<ReservationDraft, 'firstName' | 'lastName' | 'phone' | 'email'>,
  ) => void;
  setStep: (step: number) => void;
  reset: () => void;
}

const EMPTY: ReservationDraft = {};

export const useReservationStore = create<ReservationState>((set) => ({
  draft: EMPTY,
  step: 0,

  /**
   * Choosing a date clears the time.
   *
   * Which sittings exist depends on the date — a Sunday lunch service is not
   * a Tuesday dinner service — so a time chosen for one date is not
   * meaningfully a time for another. Carrying it over silently is how a guest
   * ends up requesting 22:30 on a day the kitchen shuts at nine, having
   * chosen it against a different day's list.
   */
  setDate: (date) => set((state) => ({ draft: { ...state.draft, date, time: undefined } })),

  setTime: (time) => set((state) => ({ draft: { ...state.draft, time } })),

  /**
   * Changing the party size clears the time too, for the same reason: a
   * sitting that can seat two may not seat ten, so the slot list is a
   * function of both.
   */
  setPartySize: (partySize) =>
    set((state) => ({ draft: { ...state.draft, partySize, time: undefined } })),

  setSeating: (seating) => set((state) => ({ draft: { ...state.draft, seating } })),
  setOccasion: (occasion) => set((state) => ({ draft: { ...state.draft, occasion } })),
  setNotes: (notes) => set((state) => ({ draft: { ...state.draft, notes } })),
  setDetails: (details) => set((state) => ({ draft: { ...state.draft, ...details } })),
  setStep: (step) => set({ step }),
  reset: () => set({ draft: EMPTY, step: 0 }),
}));
