/**
 * Types shared by the browser and the API. Money is always integer cents in
 * code; the database stores rands as numeric(10,2) and the repository converts
 * at the boundary, so no float arithmetic ever touches an amount.
 */

export type Service = {
  id: string;
  slug: string;
  name: string;
  description: string;
  durationMinutes: number;
  /** null → "Quote required". Never invent a price to fill this. */
  priceCents: number | null;
  /** null → no deposit option; the full amount is the only choice. */
  depositCents: number | null;
  image: string;
  sortOrder: number;
  active: boolean;
};

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'cancelled'
  | 'expired'
  /** Paid, but the hold lapsed and the slot went to someone else. Needs a person. */
  | 'needs_attention';

export type PaymentStatus = 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled';

export type PaymentOption = 'deposit' | 'full';

/** What the browser is allowed to see about a booking. */
export type PublicBooking = {
  id: string;
  serviceId: string;
  serviceName: string;
  serviceImage: string;
  durationMinutes: number;
  date: string;
  time: string;
  clientName: string;
  email: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  paymentRequired: boolean;
  priceCents: number | null;
  depositCents: number | null;
  amountPaidCents: number | null;
  holdExpiresAt: string | null;
};

export type CheckoutForm = {
  provider: string;
  action: string;
  method: 'POST' | 'GET';
  fields: Record<string, string>;
};

export type CreateBookingResult = {
  bookingId: string;
  paymentRequired: boolean;
};

export type ApiError = {
  error: string;
  /** Field-level messages, keyed by input name. */
  fields?: Record<string, string>;
};

/** A block of opening hours on one day. Bookable times are derived from open ones. */
export type OpeningHours = {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  status: 'open' | 'closed';
};

export type ServiceUpdate = Partial<Pick<Service, 'name' | 'description' | 'durationMinutes' | 'priceCents' | 'depositCents' | 'active'>>;

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: 'new' | 'replied' | 'archived';
  createdAt: string;
};

/** A booking as the studio sees it in the dashboard. */
export type AdminBooking = {
  id: string;
  serviceId: string;
  serviceName: string;
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
  reminderSentAt?: string | null;
  createdAt: string;
};
