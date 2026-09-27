import type { BookingStatus, ContactMessage, OpeningHours, PaymentOption, PaymentStatus, Service, ServiceUpdate } from '../../shared/types';
import type { Busy, Window } from '../slots';

export type Booking = {
  id: string;
  serviceId: string;
  clientName: string;
  email: string;
  phone: string;
  date: string;
  time: string;
  durationMinutes: number;
  notes: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentReference: string | null;
  holdExpiresAt: string | null;
  /** When the day-before reminder went out; null until then. */
  reminderSentAt?: string | null;
  createdAt: string;
};

export type Payment = {
  id: string;
  bookingId: string;
  amountCents: number;
  currency: 'ZAR';
  option: PaymentOption;
  provider: string;
  /** Our reference, sent to the gateway (PayFast m_payment_id). */
  reference: string;
  /** The gateway's own id (PayFast pf_payment_id), once known. */
  providerReference: string | null;
  status: PaymentStatus;
  createdAt: string;
};

export type NewBooking = Omit<Booking, 'id' | 'createdAt' | 'paymentReference'>;

export type ReserveResult = { ok: true; booking: Booking } | { ok: false; reason: 'slot_taken' };

export type ConfirmResult =
  | { outcome: 'confirmed'; booking: Booking; payment: Payment }
  | { outcome: 'already_processed'; booking: Booking; payment: Payment }
  /** Paid after the hold lapsed and someone else took the slot. */
  | { outcome: 'conflict'; booking: Booking; payment: Payment };

/**
 * Storage, behind an interface so the booking rules do not know or care
 * whether they are talking to Supabase or to the in-memory store used in
 * development and tests.
 *
 * The two methods that change who owns a slot — reserveBooking and
 * confirmPayment — must be atomic. In Postgres they are single functions
 * running in one transaction (supabase/migrations/0001_init.sql); in memory
 * they are synchronous, which in a single JS thread amounts to the same.
 */
export interface Repository {
  listServices(opts?: { includeInactive?: boolean }): Promise<Service[]>;
  getService(id: string): Promise<Service | null>;
  /** Admin: change a service's price, deposit, duration, wording or visibility. */
  updateService(id: string, patch: ServiceUpdate): Promise<Service | null>;

  /** Admin: every opening-hours block in [from, to], open or closed. */
  listOpeningHours(from: string, to: string): Promise<OpeningHours[]>;
  addOpeningHours(block: Omit<OpeningHours, 'id' | 'status'>): Promise<OpeningHours>;
  setOpeningHoursStatus(id: string, status: OpeningHours['status']): Promise<OpeningHours | null>;
  deleteOpeningHours(id: string): Promise<boolean>;

  listAvailability(from: string, to: string): Promise<Window[]>;
  /** Confirmed bookings and holds that have not yet expired, in [from, to]. */
  listBusy(from: string, to: string, now: Date): Promise<Busy[]>;

  /** Insert the booking only if nothing active overlaps it. */
  reserveBooking(booking: NewBooking, now: Date): Promise<ReserveResult>;
  getBooking(id: string): Promise<Booking | null>;
  updateBookingStatus(id: string, status: BookingStatus, paymentStatus?: PaymentStatus): Promise<Booking | null>;

  createPayment(payment: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment>;
  getPaymentByReference(reference: string): Promise<Payment | null>;
  /** Mark a payment failed/cancelled. Never downgrades a paid payment. */
  failPayment(reference: string, status: 'failed' | 'cancelled', providerReference: string | null): Promise<Payment | null>;
  /** Mark a payment paid and confirm its booking, atomically and idempotently. */
  confirmPayment(reference: string, providerReference: string, now: Date): Promise<ConfirmResult | null>;

  /** Confirmed bookings on `date` whose reminder has not been sent. */
  listRemindersDue(date: string): Promise<Booking[]>;
  markReminderSent(id: string, at: Date): Promise<void>;

  /** Admin: every booking in [from, to], newest first. */
  listBookings(from: string, to: string): Promise<Booking[]>;
  /** Move a booking to a new slot only if nothing active overlaps it there (excluding itself). */
  rescheduleBooking(id: string, date: string, time: string, now: Date): Promise<ReserveResult>;

  addSubscriber(email: string, consent: boolean): Promise<{ created: boolean }>;
  /** Returns false if the address was not subscribed. */
  unsubscribe(email: string): Promise<boolean>;
  addContactMessage(msg: { name: string; email: string; phone: string; subject: string; message: string }): Promise<void>;
  /** Admin: newest first. */
  listContactMessages(limit: number): Promise<ContactMessage[]>;
  setContactStatus(id: string, status: ContactMessage['status']): Promise<boolean>;
  countSubscribers(): Promise<number>;
}
