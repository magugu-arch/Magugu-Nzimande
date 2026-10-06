/**
 * Booking domain types — brief §10 BOOKING DATA MODEL:
 * customers, bookings, events, availability, quotes, contracts, payments,
 * notifications, documents, admin_users, internal_notes (+ an audit log, and
 * the community and collaboration inboxes).
 *
 * Money is integer cents throughout. Dates are ISO strings: `YYYY-MM-DD` for
 * calendar days, full ISO timestamps for moments.
 */

export const BOOKING_STATUSES = [
  'NEW',
  'IN_REVIEW',
  'QUOTE_SENT',
  'ON_HOLD',
  'AWAITING_DEPOSIT',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const AVAILABILITY_STATES = ['AVAILABLE', 'ON_HOLD', 'CONFIRMED', 'TRAVEL', 'UNAVAILABLE'] as const;
export type AvailabilityState = (typeof AVAILABILITY_STATES)[number];

export const EVENT_TYPES = [
  { key: 'corporate', label: 'Corporate event' },
  { key: 'private', label: 'Private celebration' },
  { key: 'wedding', label: 'Wedding' },
  { key: 'festival', label: 'Festival' },
  { key: 'concert', label: 'Concert or club night' },
  { key: 'brand', label: 'Brand activation' },
  { key: 'other', label: 'Something else' },
] as const;
export type EventType = (typeof EVENT_TYPES)[number]['key'];

export const PERFORMANCE_FORMATS = [
  { key: 'headline', label: 'Headline performance' },
  { key: 'live-band', label: 'Live with band' },
  { key: 'dj-set', label: 'Producer / DJ set' },
  { key: 'private-performance', label: 'Private or corporate performance' },
  { key: 'undecided', label: 'Not sure yet — advise me' },
] as const;
export type PerformanceFormat = (typeof PERFORMANCE_FORMATS)[number]['key'];

export const BUDGET_RANGES = [
  { key: 'under-150k', label: 'Under R150 000' },
  { key: '150k-300k', label: 'R150 000 – R300 000' },
  { key: '300k-600k', label: 'R300 000 – R600 000' },
  { key: 'over-600k', label: 'Over R600 000' },
  { key: 'discuss', label: 'Prefer to discuss' },
] as const;
export type BudgetRange = (typeof BUDGET_RANGES)[number]['key'];

export type Customer = {
  id: string;
  fullName: string;
  organisation: string | null;
  email: string;
  phone: string;
  /** Explicit opt-in to booking updates on WhatsApp. */
  whatsappOptIn: boolean;
  createdAt: string;
};

export type Booking = {
  id: string;
  /** ZB-YYYY-XXXX — shareable, but grants nothing on its own. */
  reference: string;
  customerId: string;
  eventId: string;
  status: BookingStatus;
  eventType: EventType;
  performanceFormat: PerformanceFormat;
  budgetRange: BudgetRange;
  expectedAttendance: number;
  travelRequired: boolean;
  travelNotes: string | null;
  accommodationRequired: boolean;
  accommodationNotes: string | null;
  productionNotes: string | null;
  additionalInfo: string | null;
  /** SHA-256 of the client portal token. The token itself is only ever emailed. */
  portalTokenHash: string;
  holdExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EventRecord = {
  id: string;
  bookingId: string | null;
  kind: 'private' | 'public';
  title: string;
  date: string;
  startTime: string | null;
  endTime: string | null;
  venue: string;
  city: string;
  country: string;
  /** Public shows only. */
  ticketUrl: string | null;
  description: string | null;
  published: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AvailabilityEntry = {
  date: string;
  state: AvailabilityState;
  bookingId: string | null;
  /** Internal only — never sent to the public calendar. */
  note: string | null;
  updatedAt: string;
  updatedBy: string;
};

export const QUOTE_LINE_KINDS = ['performance', 'travel', 'accommodation', 'production', 'additional'] as const;
export type QuoteLineKind = (typeof QUOTE_LINE_KINDS)[number];
export type QuoteLine = { kind: QuoteLineKind; description: string; amountCents: number };

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'changes_requested' | 'superseded';

export type Quote = {
  id: string;
  bookingId: string;
  version: number;
  status: QuoteStatus;
  currency: 'ZAR';
  lines: QuoteLine[];
  taxApplicable: boolean;
  /** Basis points: 1500 = 15%. */
  taxRateBps: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  depositPercent: number;
  depositCents: number;
  balanceCents: number;
  depositDueDate: string;
  balanceDueDate: string | null;
  validUntil: string;
  cancellationTerms: string;
  clientMessage: string | null;
  clientResponseNote: string | null;
  createdAt: string;
  sentAt: string | null;
  respondedAt: string | null;
};

export type Contract = {
  id: string;
  bookingId: string;
  quoteId: string;
  status: 'draft' | 'sent' | 'signed' | 'void';
  /** The agreement text as issued, frozen so a signature always refers to fixed terms. */
  terms: string;
  termsHash: string;
  signerName: string | null;
  signerIpHash: string | null;
  signedAt: string | null;
  sentAt: string | null;
  createdAt: string;
};

export type PaymentStatus = 'pending' | 'complete' | 'failed' | 'cancelled' | 'refunded';

export type Payment = {
  id: string;
  bookingId: string;
  quoteId: string;
  kind: 'deposit' | 'balance';
  provider: string;
  /** Our reference sent to the provider (PayFast m_payment_id). Unique. */
  merchantReference: string;
  /** The provider's own transaction id, once known. */
  providerReference: string | null;
  amountCents: number;
  currency: 'ZAR';
  status: PaymentStatus;
  createdAt: string;
  updatedAt: string;
};

export type NotificationChannel = 'email' | 'sms' | 'whatsapp';

export type NotificationRecord = {
  id: string;
  bookingId: string | null;
  event: string;
  channel: NotificationChannel;
  audience: 'client' | 'management';
  /** Masked recipient, for the audit view. */
  recipient: string;
  status: 'sent' | 'failed' | 'skipped' | 'logged';
  provider: string;
  providerId: string | null;
  error: string | null;
  createdAt: string;
};

export type DocumentRecord = {
  id: string;
  bookingId: string;
  kind: 'brief' | 'agreement' | 'rider' | 'receipt' | 'other';
  filename: string;
  contentType: string;
  size: number;
  storageKey: string;
  uploadedBy: 'client' | 'admin';
  /** Whether the client may download it from their portal. */
  clientVisible: boolean;
  createdAt: string;
};

export type AdminRole = 'owner' | 'manager' | 'viewer';

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  passwordHash: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type InternalNote = {
  id: string;
  bookingId: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
};

export type AuditEntry = {
  id: string;
  bookingId: string | null;
  actor: string;
  action: string;
  detail: Record<string, unknown>;
  createdAt: string;
};

export type CommunitySignup = {
  id: string;
  email: string;
  phone: string | null;
  emailConsent: boolean;
  whatsappConsent: boolean;
  /** The exact wording the person agreed to. */
  consentText: string;
  source: string;
  createdAt: string;
};

export const COLLABORATION_TYPES = [
  { key: 'brand', label: 'Brand partnership' },
  { key: 'music', label: 'Music collaboration' },
  { key: 'cultural', label: 'Cultural project' },
  { key: 'festival', label: 'Festival' },
  { key: 'content', label: 'Content' },
  { key: 'production', label: 'Production' },
  { key: 'media', label: 'Media' },
] as const;
export type CollaborationType = (typeof COLLABORATION_TYPES)[number]['key'];

export type CollaborationRequest = {
  id: string;
  type: CollaborationType;
  name: string;
  organisation: string | null;
  email: string;
  phone: string | null;
  timeline: string | null;
  budget: string | null;
  message: string;
  status: 'new' | 'reviewed' | 'archived';
  createdAt: string;
};
