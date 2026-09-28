import { create } from 'zustand';
import type { Occasion, ReservationSlot } from '@/domain/reservations/types';
import { newIdempotencyKey } from '@/domain/shared/ids';

/**
 * The booking in progress, across the three steps of the flow. The
 * idempotency key is minted when the guest reaches review and kept until the
 * booking succeeds, so a double tap or a retry after a timeout can never
 * create two tables.
 */
export interface BookingDraft {
  date: string | null;
  partySize: number;
  children: number;
  slot: ReservationSlot | null;
  waitlistId?: string;
  occasion?: Occasion;
  occasionNote: string;
  seatingPreference?: string;
  dietaryNotes: string;
  accessibilityNotes: string;
  specialRequest: string;
  name: string;
  email: string;
  phone: string;
  idempotencyKey: string;
}

const blank = (): BookingDraft => ({
  date: null,
  partySize: 2,
  children: 0,
  slot: null,
  occasionNote: '',
  dietaryNotes: '',
  accessibilityNotes: '',
  specialRequest: '',
  name: '',
  email: '',
  phone: '',
  idempotencyKey: newIdempotencyKey(),
});

interface DraftStore extends BookingDraft {
  set(patch: Partial<BookingDraft>): void;
  reset(): void;
  /** A new key for a genuinely new attempt (e.g. after choosing a different time). */
  rekey(): void;
}

export const useBookingDraft = create<DraftStore>()((set) => ({
  ...blank(),
  set: (patch) => set(patch),
  reset: () => set(blank()),
  rekey: () => set({ idempotencyKey: newIdempotencyKey() }),
}));
