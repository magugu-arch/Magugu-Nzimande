import type { Appointment, AppointmentType, AvailableSlot } from '@/domain/types';

export type AppointmentRequest = {
  typeId: string;
  slotId: string;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
};

/**
 * Styling appointments. A booking is a capacity-controlled transaction, not a
 * button tap: the provider holds the slot, enforces capacity and blackout
 * days, and is the only thing that can say "confirmed". Until an authorised
 * scheduling system is connected, the app sends a request and shows it as
 * pending — never as booked.
 */
export interface BookingProvider {
  readonly id: string;
  readonly isMock: boolean;
  /** IANA zone the studio's times are expressed in. */
  readonly timeZone: string;

  listTypes(): Promise<AppointmentType[]>;
  listSlots(typeId: string, fromDate: Date, days: number): Promise<AvailableSlot[]>;

  /** Same idempotency key, same appointment: a double tap cannot double-book. */
  requestAppointment(request: AppointmentRequest, idempotencyKey: string): Promise<Appointment>;
}
