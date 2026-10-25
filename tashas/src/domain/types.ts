/**
 * Central domain model.
 *
 * The brief (§12, §13.5, §13.9, §13.12) names these shapes; where it gives a
 * type verbatim it is reproduced verbatim, and extensions are marked. Every
 * persistent record lives here so the web app, an API server and admin tools
 * read the same definitions, and no business rule hides in a screen.
 */

import type { DateKey, TimeKey } from './util/time.ts';
import type { Minor } from './util/core.ts';

// ------------------------------------------------------------ brand assets

/** Brief §12, src/assets/types.ts. */
export interface BrandImageAsset {
  id: string;
  originalFilename: string;
  title: string;
  altText: string;
  width: number;
  height: number;
  fileSizeBytes: number;
  sha256: string;
  role: 'food' | 'coffee' | 'interior' | 'people' | 'ingredients' | 'campaign';
  recommendedUse: string;
  exif: Record<string, string>;
  publicUrl?: string; // assigned only after approved upload/CDN deployment
}

// ----------------------------------------------------------------- content

/** Everything shipped today is sample content until Tashas approves it. */
export type ContentStatus = 'sample' | 'approved';

export type ServicePeriodId = 'breakfast' | 'lunch';

export interface ServicePeriod {
  id: ServicePeriodId;
  label: string;
  firstSeating: TimeKey;
  lastSeating: TimeKey;
}

export interface DepositRule {
  id: string;
  label: string;
  perGuestMinor: Minor;
  minPartySize: number;
  /** 0 = Sunday … 6 = Saturday; omitted means every day. */
  weekdays?: number[];
  periods?: ServicePeriodId[];
}

export interface BookingPolicy {
  version: string;
  slotIntervalMinutes: number;
  /** How long the provider holds a chosen slot while the guest finishes. */
  holdMinutes: number;
  minLeadMinutes: number;
  maxDaysAhead: number;
  maxOnlinePartySize: number;
  deposits: DepositRule[];
  freeCancellationHours: number;
  /** Share of the deposit returned for a cancellation inside the window. */
  lateCancellationRefundPercent: number;
  graceMinutes: number;
  noShowRetainsDeposit: boolean;
  amendCutoffHours: number;
  waitlist: boolean;
  seatingOptions: string[];
  acceptsAccessibilityNotes: boolean;
  reminderOffsetsHours: number[];
}

export interface Branch {
  id: string;
  slug: string;
  name: string;
  suburb: string;
  city: string;
  province: string;
  country: string;
  utcOffsetMinutes: number;
  timeZone: string;
  /** Suburb centroid for distance sorting; not a verified street location. */
  coords: { lat: number; lng: number };
  address: string | null;
  phone: string | null;
  email: string | null;
  googleBusinessProfileUrl: string | null;
  hours: { days: string; hours: string }[];
  services: ServicePeriod[];
  closedWeekdays: number[];
  story: { title: string; body: string };
  heroImageId: string;
  galleryImageIds: string[];
  amenities: string[];
  /** Order-ahead only where Tashas confirms the branch and system support it. */
  ordering: boolean;
  contentStatus: ContentStatus;
  policy: BookingPolicy;
  /** Covers per slot in the sandbox reservation provider. */
  sandboxCoversPerSlot: number;
}

export interface MenuCategory {
  id: string;
  label: string;
  blurb: string;
}

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  priceMinor: Minor;
  imageId: string;
  /** Shown only once verified by Tashas; empty until then. */
  dietary: string[];
  allergensVerified: boolean;
  periods: ServicePeriodId[];
  contentStatus: ContentStatus;
}

export interface EventListing {
  id: string;
  branchId: string;
  title: string;
  summary: string;
  body: string;
  imageId: string;
  /** Days from today, so the sample calendar never goes stale. */
  dayOffset: number;
  time: TimeKey;
  durationMinutes: number;
  capacity: number;
  priceMinorPerGuest: Minor;
  terms: string;
  contentStatus: ContentStatus;
}

export type CampaignAction =
  | { kind: 'book'; period?: ServicePeriodId; weekday?: number }
  | { kind: 'find-cafe' }
  | { kind: 'event'; eventId: string }
  | { kind: 'notify'; topic: string }
  | { kind: 'menu'; categoryId: string };

export interface CampaignPage {
  slug: string;
  eyebrow: string;
  title: string;
  body: string[];
  heroImageId: string;
  primary: { label: string; action: CampaignAction };
  utmCampaign: string;
  contentStatus: ContentStatus;
}

export interface RewardOffer {
  id: string;
  title: string;
  description: string;
  pointsCost: number;
  imageId: string;
  voucherValidDays: number;
}

export interface RewardRules {
  version: string;
  pointsPerCompletedVisit: number;
  pointsPerEventAttendance: number;
  pointExpiryDays: number;
  tiers: { id: string; label: string; minLifetimePoints: number }[];
  catalogue: RewardOffer[];
  contentStatus: ContentStatus;
}

// ------------------------------------------------------------------ guests

export interface Guest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  /** SHA-256 of normalised email/phone, so suppression survives erasure. */
  contactHash: string;
  birthday: string | null;
  homeBranchId: string | null;
  pushToken: string | null;
  pushTokenValid: boolean;
  utcOffsetMinutes: number;
  createdAt: number;
  /** Synthetic guests seeded so campaigns have an audience in the sandbox. */
  isDemoPopulation: boolean;
  erasedAt: number | null;
}

// ----------------------------------------------------------------- booking

/** Brief §12, src/booking/types.ts. */
export type BookingStatus =
  | 'requested'
  | 'confirmed'
  | 'amended'
  | 'cancelled'
  | 'completed'
  | 'no-show'
  | 'waitlisted';

/** Brief §12. */
export interface BookingRequest {
  branchId: string;
  date: string;
  time: string;
  partySize: number;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  occasion?: string;
  specialRequest?: string;
  idempotencyKey: string;
}

/** Brief §13.2 state machine for the attempt that becomes a booking. */
export type AttemptState =
  | 'draft'
  | 'availability-selected'
  | 'pending-payment'
  | 'requested'
  | 'confirmed'
  | 'reconciliation'
  | 'cancelled'
  | 'waitlisted'
  | 'failed'
  | 'expired';

export interface SelectedSlot {
  date: DateKey;
  time: TimeKey;
  period: ServicePeriodId;
  partySize: number;
  startsAt: number;
}

export interface GuestDetails {
  name: string;
  email: string;
  phone: string;
  occasion?: string;
  specialRequest?: string;
  seating?: string;
  accessibilityNote?: string;
}

export interface BookingAttempt {
  id: string;
  guestId: string | null;
  branchId: string;
  selectedSlot: SelectedSlot | null;
  state: AttemptState;
  holdId: string | null;
  expiryAt: number | null;
  idempotencyKey: string;
  correlationId: string;
  guestDetails: GuestDetails | null;
  depositAmountMinor: Minor;
  policyVersion: string | null;
  policyAcceptedAt: number | null;
  paymentId: string | null;
  bookingId: string | null;
  failureReason: string | null;
  providerCreateAttempts: number;
  attribution: AttributionSnapshot | null;
  /** Set when an amendment needs a top-up payment before it applies. */
  amendsBookingId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface Booking {
  id: string;
  reference: string;
  guestId: string;
  branchId: string;
  provider: string;
  externalId: string | null;
  status: BookingStatus;
  date: DateKey;
  time: TimeKey;
  period: ServicePeriodId;
  startsAt: number;
  partySize: number;
  policyVersion: string;
  depositAmountMinor: Minor;
  depositPaidMinor: Minor;
  depositRefundedMinor: Minor;
  paymentIds: string[];
  occasion: string | null;
  specialRequest: string | null;
  seating: string | null;
  attemptId: string | null;
  attribution: AttributionSnapshot | null;
  /** Bumped on every reschedule so reminder dedupe keys change with it. */
  version: number;
  createdAt: number;
  updatedAt: number;
}

export interface BookingEvent {
  id: string;
  bookingId: string | null;
  providerEventId: string | null;
  eventType: string;
  payloadRedacted: Record<string, unknown>;
  signatureVerified: boolean;
  receivedAt: number;
  processedAt: number | null;
  outcome: 'processed' | 'duplicate' | 'rejected' | 'ignored';
}

// ---------------------------------------------------------------- payments

/** Brief §13.5, verbatim. */
export type PaymentStatus =
  | 'created'
  | 'pending'
  | 'requires-action'
  | 'authorised'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'refund-pending'
  | 'partially-refunded'
  | 'refunded';

export type PaymentPurpose = 'reservation-deposit' | 'event' | 'voucher' | 'order';

export interface CreatePaymentRequest {
  guestId?: string;
  bookingAttemptId?: string;
  purpose: PaymentPurpose;
  referenceId: string;
  amountMinor: number; // ZAR cents; integer only
  currency: 'ZAR' | string; // validate against gateway/account config
  description: string;
  returnUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface PaymentRecord {
  id: string;
  provider: string;
  providerPaymentId?: string;
  referenceId: string;
  status: PaymentStatus;
  amountMinor: number;
  currency: string;
  purpose: PaymentPurpose;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentProvider {
  createCheckout(request: CreatePaymentRequest): Promise<{
    payment: PaymentRecord;
    checkoutUrl?: string;
    clientToken?: string;
  }>;
  getStatus(paymentId: string): Promise<PaymentRecord>;
  refund(request: {
    paymentId: string;
    amountMinor?: number;
    reason: string;
    idempotencyKey: string;
  }): Promise<PaymentRecord>;
  verifyWebhook(
    rawBody: Uint8Array,
    headers: Record<string, string>,
  ): Promise<{
    eventId: string;
    payment: PaymentRecord;
    eventType: string;
  }>;
}

/** Internal payment row (brief §13.12 Payment), richer than the wire record. */
export interface Payment {
  id: string;
  provider: string;
  providerPaymentId: string | null;
  purpose: PaymentPurpose;
  referenceId: string;
  bookingAttemptId: string | null;
  guestId: string | null;
  amountMinor: Minor;
  currency: string;
  status: PaymentStatus;
  refundedMinor: Minor;
  idempotencyKey: string;
  gatewayReference: string | null;
  checkoutUrl: string | null;
  description: string;
  metadata: Record<string, string>;
  history: { status: PaymentStatus; at: number; source: string }[];
  createdAt: number;
  updatedAt: number;
}

export interface PaymentEvent {
  id: string;
  providerEventId: string | null;
  paymentId: string | null;
  eventType: string;
  rawPayloadRedacted: Record<string, unknown>;
  signatureVerified: boolean;
  receivedAt: number;
  processedAt: number | null;
  outcome: 'processed' | 'duplicate' | 'rejected' | 'ignored-stale';
}

export interface Refund {
  id: string;
  paymentId: string;
  amountMinor: Minor;
  reason: string;
  status: 'pending' | 'succeeded' | 'failed';
  approvedBy: string;
  providerReference: string | null;
  idempotencyKey: string;
  createdAt: number;
  updatedAt: number;
}

// --------------------------------------------- consent and preferences

/** Brief §12, src/notifications/types.ts. */
export type Channel = 'in-app' | 'push' | 'email' | 'sms' | 'whatsapp';

export type NotificationCategory = 'booking' | 'service' | 'rewards' | 'events' | 'marketing';

/** Brief §12 GuestPreference, plus an id so it can be stored. */
export interface GuestPreference {
  id: string;
  guestId: string;
  category: NotificationCategory;
  enabled: boolean;
  channels: Channel[];
  updatedAt: string;
}

export type ConsentSource =
  | 'booking-form'
  | 'preference-centre'
  | 'newsletter-form'
  | 'campaign-landing'
  | 'unsubscribe-link'
  | 'staff'
  | 'demo-seed';

/** Append-only: every change is a new row, the latest per channel wins. */
export interface GuestConsent {
  id: string;
  guestId: string;
  contactHash: string;
  purpose: 'marketing';
  channel: Channel;
  status: 'granted' | 'withdrawn';
  consentTextVersion: string;
  consentText: string;
  source: ConsentSource;
  capturedAt: number;
  withdrawnAt: number | null;
}

export interface SuppressionEntry {
  id: string;
  contactHash: string | null;
  guestId: string | null;
  channel: Channel | 'all';
  reason: 'unsubscribe' | 'hard-bounce' | 'complaint' | 'staff' | 'erasure';
  createdAt: number;
}

// ----------------------------------------------------------- notifications

export interface AppLink {
  screen: 'booking' | 'campaign' | 'rewards' | 'event' | 'preferences' | 'menu' | 'cafe' | 'book';
  id?: string;
  utm?: Utm;
  campaignId?: string;
}

export type NotificationStatus =
  | 'scheduled'
  | 'sent'
  | 'partially-sent'
  | 'suppressed'
  | 'cancelled'
  | 'failed';

export interface NotificationRecord {
  id: string;
  guestId: string;
  category: NotificationCategory;
  kind: 'transactional' | 'marketing';
  templateId: string;
  templateVersion: number;
  title: string;
  body: string;
  payload: Record<string, string | number | null>;
  dedupeKey: string;
  scheduledAt: number;
  status: NotificationStatus;
  suppressedReason: string | null;
  campaignId: string | null;
  channels: Channel[];
  link: AppLink | null;
  readAt: number | null;
  createdAt: number;
}

export type DeliveryStatus =
  | 'queued'
  | 'accepted'
  | 'delivered'
  | 'retrying'
  | 'failed'
  | 'bounced'
  | 'blocked';

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  guestId: string;
  channel: Channel;
  providerMessageId: string | null;
  status: DeliveryStatus;
  attempts: number;
  lastError: string | null;
  nextAttemptAt: number | null;
  sentAt: number | null;
}

// ----------------------------------------------------------------- rewards

/** Brief §12, src/rewards/types.ts. */
export type RewardTxnType = 'earn' | 'redeem' | 'expire' | 'reverse' | 'adjust';

/** Brief §12 RewardLedgerEntry, with expiry and reversal links added. */
export interface RewardLedgerEntry {
  id: string;
  guestId: string;
  type: RewardTxnType;
  points: number;
  referenceType: 'booking' | 'visit' | 'campaign' | 'admin';
  referenceId: string;
  idempotencyKey: string;
  createdAt: string;
  expiresAt: string | null;
  reversesEntryId: string | null;
  note: string | null;
}

export interface Voucher {
  id: string;
  code: string;
  guestId: string;
  offerId: string;
  title: string;
  status: 'active' | 'redeemed' | 'expired';
  issuedAt: number;
  expiresAt: number;
  redeemedAt: number | null;
  ledgerEntryId: string;
}

// ------------------------------------------------- marketing and attribution

export interface Utm {
  source: string;
  medium: string;
  campaign: string;
  content?: string;
  term?: string;
}

export interface AttributionTouch {
  utm: Utm;
  campaignId: string | null;
  landingSlug: string | null;
  at: number;
}

export interface AttributionSnapshot {
  firstTouch: AttributionTouch | null;
  lastTouch: AttributionTouch | null;
}

export interface AudienceRule {
  branchIds: string[];
  minCompletedVisits?: number;
  inactiveForDays?: number;
  lastVisitWithinDays?: number;
  rewardTier?: string;
}

export type CampaignStatus =
  | 'draft'
  | 'pending-approval'
  | 'approved'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'paused'
  | 'cancelled';

export interface CampaignStats {
  targeted: number;
  eligible: number;
  excluded: Record<string, number>;
  sent: number;
  delivered: number;
  failed: number;
  blockedAtSend: number;
  optOuts: number;
  conversions: number;
  attributedBookings: number;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channel: Channel;
  templateId: string;
  audience: AudienceRule;
  audienceRuleVersion: number;
  consentPolicyVersion: string;
  landingSlug: string;
  utm: Utm;
  frequencyCapPerWeek: number;
  attributionWindowDays: number;
  scheduledAt: number | null;
  createdBy: string;
  approvedBy: string | null;
  sentAt: number | null;
  stats: CampaignStats;
  history: { at: number; actor: string; action: string }[];
  createdAt: number;
  updatedAt: number;
}

// ------------------------------------------------------------ domain events

/** Brief §13.9, with the extensions this build needs marked "added". */
export type TashasDomainEvent =
  | { type: 'booking.started'; attemptId: string; branchId: string }
  | { type: 'booking.confirmed'; bookingId: string; guestId: string; startsAt: string }
  | { type: 'booking.cancelled'; bookingId: string; guestId: string; reason?: string }
  | { type: 'booking.completed'; bookingId: string; guestId: string; branchId: string }
  | { type: 'payment.succeeded'; paymentId: string; referenceId: string; guestId?: string; amountMinor: number }
  | { type: 'payment.failed'; paymentId: string; referenceId: string; guestId?: string }
  | { type: 'payment.refunded'; paymentId: string; referenceId: string; amountMinor: number }
  | { type: 'reward.earned'; guestId: string; points: number; referenceId: string }
  | { type: 'campaign.conversion'; campaignId: string; conversionType: string; referenceId: string }
  // added
  | { type: 'booking.amended'; bookingId: string; guestId: string; startsAt: string }
  | { type: 'booking.no-show'; bookingId: string; guestId: string }
  | { type: 'booking.waitlisted'; bookingId: string; guestId: string }
  | { type: 'booking.failed'; attemptId: string; guestId: string | null; reason: string }
  | { type: 'booking.reconciliation-required'; attemptId: string; guestId: string | null; reason: string }
  | { type: 'payment.cancelled'; paymentId: string; referenceId: string; guestId?: string }
  | { type: 'reward.redeemed'; guestId: string; points: number; voucherId: string }
  | { type: 'event-booking.confirmed'; eventBookingId: string; guestId: string; eventId: string }
  | { type: 'guest.consent-changed'; guestId: string; channel: Channel; status: 'granted' | 'withdrawn' };

export type DomainEventType = TashasDomainEvent['type'];

/** Brief §13.9. */
export interface EventEnvelope<T> {
  eventId: string;
  occurredAt: string;
  schemaVersion: number;
  correlationId: string;
  payload: T;
}

/** Brief §13.12 DomainOutbox, plus per-consumer delivery tracking. */
export interface OutboxRow {
  id: string;
  eventType: DomainEventType;
  schemaVersion: number;
  aggregateId: string;
  correlationId: string;
  payload: TashasDomainEvent;
  occurredAt: number;
  publishedAt: number | null;
  attempts: number;
  nextAttemptAt: number | null;
  deliveredTo: string[];
  status: 'pending' | 'published' | 'dead-letter';
  lastError: string | null;
}

// ----------------------------------------------------------- staff, audit

export type StaffRole = 'host' | 'manager' | 'finance' | 'marketer' | 'admin';

export interface Actor {
  kind: 'guest' | 'staff' | 'system' | 'provider';
  id: string;
  role?: StaffRole;
}

export interface AuditEntry {
  id: string;
  at: number;
  actor: Actor;
  action: string;
  entityType: string;
  entityId: string;
  details: Record<string, unknown>;
}

export interface StaffAlert {
  id: string;
  at: number;
  severity: 'info' | 'warning' | 'critical';
  title: string;
  body: string;
  entityType: string;
  entityId: string;
  resolvedAt: number | null;
  resolvedBy: string | null;
}

// ------------------------------------------------------- event bookings

export interface EventBooking {
  id: string;
  reference: string;
  eventId: string;
  guestId: string;
  partySize: number;
  status: 'pending-payment' | 'confirmed' | 'cancelled' | 'failed';
  amountMinor: Minor;
  paymentId: string | null;
  idempotencyKey: string;
  attribution: AttributionSnapshot | null;
  createdAt: number;
  updatedAt: number;
}

// --------------------------------------------------------------- analytics

export interface AnalyticsEvent {
  id: string;
  name: string;
  at: number;
  sessionId: string;
  props: Record<string, string | number | boolean | null>;
  campaign: string | null;
}

export interface Favourite {
  id: string;
  guestId: string;
  kind: 'menu-item' | 'branch';
  refId: string;
  createdAt: number;
}

// ---------------------------------------------------------------- settings

export interface SandboxScenario {
  /** Next reservation create: succeed, commit then time out, or refuse. */
  nextCreate: 'normal' | 'timeout-after-commit' | 'unavailable' | 'error';
  /** Another guest takes the held slot just before confirmation. */
  stealHeldSlot: boolean;
  /** Webhooks arrive twice, to prove deduplication. */
  duplicateWebhooks: boolean;
  /** Webhooks are lost; only the status API reveals the outcome. */
  dropWebhooks: boolean;
  /** Reservation provider is down: availability and create fail. */
  reservationOutage: boolean;
  /** Next email send fails transiently this many times. */
  emailFailures: number;
}

export interface Settings {
  id: 'global';
  autoRefundOnBookingFailure: boolean;
  marketingFrequencyCapPerWeek: number;
  quietHours: { start: TimeKey; end: TimeKey };
  consentTextVersion: string;
  consentText: string;
  publicAppUrl: string | null;
  sandbox: SandboxScenario;
}

export interface BranchOverride {
  id: string;
  policy: Partial<BookingPolicy>;
  updatedAt: number;
  updatedBy: string;
}

// ------------------------------------------------------- sandbox providers

export interface SandboxReservation {
  id: string;
  branchId: string;
  date: DateKey;
  time: TimeKey;
  partySize: number;
  status: 'booked' | 'cancelled' | 'seated' | 'completed' | 'no-show';
  idempotencyKey: string;
  waitlist: boolean;
  createdAt: number;
}

export interface SandboxHold {
  id: string;
  branchId: string;
  date: DateKey;
  time: TimeKey;
  partySize: number;
  expiresAt: number;
  released: boolean;
}

export interface SandboxGatewayPayment {
  id: string;
  merchantReference: string;
  purpose: PaymentPurpose;
  amountMinor: Minor;
  currency: string;
  status: PaymentStatus;
  refundedMinor: Minor;
  idempotencyKey: string;
  refundKeys: string[];
  description: string;
  createdAt: number;
  updatedAt: number;
}

export interface SandboxWebhook {
  id: string;
  target: 'payments' | 'reservations';
  body: string;
  headers: Record<string, string>;
  deliverAt: number;
  deliveredAt: number | null;
  attempts: number;
}
