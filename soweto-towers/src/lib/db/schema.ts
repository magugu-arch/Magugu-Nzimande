import { boolean, date, index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * Amounts are whole rand (every price on the list is a whole rand). Calendar
 * days are SAST 'YYYY-MM-DD'; slot times are SAST 'HH:MM'.
 */

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => ts('created_at').defaultNow().notNull();

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: jsonb('value').notNull(),
  updatedAt: ts('updated_at').defaultNow().notNull(),
});

export type BookingStatus = 'held' | 'pending_payment' | 'paid' | 'cancelled' | 'expired' | 'refunded';
export type BookingKind = 'adventure' | 'voucher' | 'event';

export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ref: varchar('ref', { length: 12 }).notNull(),
    kind: text('kind').$type<BookingKind>().notNull(),
    status: text('status').$type<BookingStatus>().notNull(),
    visitDate: date('visit_date', { mode: 'string' }),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone').notNull(),
    notifyWhatsapp: boolean('notify_whatsapp').default(true).notNull(),
    marketingOptIn: boolean('marketing_opt_in').default(false).notNull(),
    clipConsent: boolean('clip_consent').default(false).notNull(),
    packageId: text('package_id'),
    subtotal: integer('subtotal_zar').notNull(),
    discount: integer('discount_zar').default(0).notNull(),
    voucherApplied: integer('voucher_applied_zar').default(0).notNull(),
    total: integer('total_zar').notNull(),
    voucherCode: text('voucher_code'),
    source: text('source'),
    partnerCode: text('partner_code'),
    paymentProvider: text('payment_provider'),
    paymentRef: text('payment_ref'),
    paidAt: ts('paid_at'),
    holdExpiresAt: ts('hold_expires_at'),
    ticketToken: text('ticket_token').notNull(),
    checkedInAt: ts('checked_in_at'),
    checkedInBy: text('checked_in_by'),
    waiver: jsonb('waiver').$type<{
      signedName: string;
      signedAt: string;
      guardian?: { name: string; for: string[] } | null;
      acceptedMedical: boolean;
      acceptedTerms: boolean;
    } | null>(),
    notes: text('notes'),
    meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
    reminderSentAt: ts('reminder_sent_at'),
    followUpSentAt: ts('follow_up_sent_at'),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('bookings_ref_uq').on(t.ref),
    index('bookings_visit_idx').on(t.visitDate),
    index('bookings_status_idx').on(t.status),
    index('bookings_email_idx').on(t.email),
  ],
);

export type ItemKind = 'activity' | 'addon' | 'voucher' | 'event';

export const bookingItems = pgTable(
  'booking_items',
  {
    id: serial('id').primaryKey(),
    bookingId: uuid('booking_id')
      .notNull()
      .references(() => bookings.id, { onDelete: 'cascade' }),
    kind: text('kind').$type<ItemKind>().notNull(),
    sku: text('sku').notNull(),
    label: text('label').notNull(),
    slotDate: date('slot_date', { mode: 'string' }),
    slotTime: varchar('slot_time', { length: 5 }),
    resource: text('resource'),
    units: integer('units').default(0).notNull(),
    qty: integer('qty').notNull(),
    unitPrice: integer('unit_price_zar').notNull(),
    total: integer('total_zar').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
  },
  (t) => [index('items_slot_idx').on(t.resource, t.slotDate, t.slotTime), index('items_booking_idx').on(t.bookingId)],
);

export const participants = pgTable('participants', {
  id: serial('id').primaryKey(),
  bookingId: uuid('booking_id')
    .notNull()
    .references(() => bookings.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  weightKg: integer('weight_kg'),
  ageBand: text('age_band').$type<'adult' | 'minor'>().notNull(),
  activities: jsonb('activities').$type<string[]>().default([]).notNull(),
});

export type VoucherStatus = 'pending' | 'active' | 'redeemed' | 'void' | 'expired';

export const vouchers = pgTable(
  'vouchers',
  {
    code: varchar('code', { length: 16 }).primaryKey(),
    kind: text('kind').$type<'amount' | 'package' | 'activity'>().notNull(),
    sku: text('sku'),
    label: text('label').notNull(),
    value: integer('value_zar').notNull(),
    balance: integer('balance_zar').notNull(),
    purchaserName: text('purchaser_name').notNull(),
    purchaserEmail: text('purchaser_email').notNull(),
    recipientName: text('recipient_name').notNull(),
    recipientEmail: text('recipient_email'),
    recipientPhone: text('recipient_phone'),
    message: text('message'),
    deliverOn: date('deliver_on', { mode: 'string' }),
    deliveredAt: ts('delivered_at'),
    status: text('status').$type<VoucherStatus>().notNull(),
    expiresAt: ts('expires_at').notNull(),
    purchaseBookingId: uuid('purchase_booking_id'),
    token: text('token').notNull(),
    createdAt: created(),
  },
  (t) => [index('vouchers_status_idx').on(t.status)],
);

export type EventStatus = 'draft' | 'published' | 'cancelled';

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    body: text('body').notNull(),
    tag: text('tag').notNull(),
    startsAt: ts('starts_at').notNull(),
    endsAt: ts('ends_at').notNull(),
    image: text('image').notNull(),
    /** Ticket price per person; null for free entry with RSVP. */
    price: integer('price_zar'),
    capacity: integer('capacity').notNull(),
    status: text('status').$type<EventStatus>().notNull(),
    createdAt: created(),
    updatedAt: ts('updated_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('events_slug_uq').on(t.slug), index('events_start_idx').on(t.startsAt)],
);

export type EnquiryType = 'group' | 'corporate' | 'school' | 'tour_operator' | 'hotel' | 'partner' | 'media' | 'venue' | 'base_jump' | 'general';

export const enquiries = pgTable(
  'enquiries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: text('type').$type<EnquiryType>().notNull(),
    name: text('name').notNull(),
    email: text('email').notNull(),
    phone: text('phone'),
    company: text('company'),
    groupSize: integer('group_size'),
    preferredDate: date('preferred_date', { mode: 'string' }),
    message: text('message').notNull(),
    status: text('status').$type<'new' | 'replied' | 'closed'>().default('new').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: created(),
  },
  (t) => [index('enquiries_status_idx').on(t.status)],
);

export const tableRequests = pgTable('table_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  email: text('email'),
  date: date('date', { mode: 'string' }).notNull(),
  time: varchar('time', { length: 5 }).notNull(),
  partySize: integer('party_size').notNull(),
  notes: text('notes'),
  bookingRef: text('booking_ref'),
  status: text('status').$type<'requested' | 'confirmed' | 'declined'>().default('requested').notNull(),
  createdAt: created(),
});

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull(),
    name: text('name'),
    contact: text('contact'),
    page: text('page'),
    status: text('status').$type<'open' | 'closed'>().default('open').notNull(),
    unreadForStaff: integer('unread_for_staff').default(0).notNull(),
    unreadForVisitor: integer('unread_for_visitor').default(0).notNull(),
    lastMessageAt: ts('last_message_at').defaultNow().notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex('conversations_token_uq').on(t.token), index('conversations_last_idx').on(t.lastMessageAt)],
);

export const messages = pgTable(
  'messages',
  {
    id: serial('id').primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    sender: text('sender').$type<'visitor' | 'staff' | 'bot'>().notNull(),
    staffName: text('staff_name'),
    body: text('body').notNull(),
    createdAt: created(),
  },
  (t) => [index('messages_conv_idx').on(t.conversationId, t.id)],
);

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: serial('id').primaryKey(),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    topics: jsonb('topics').$type<string[]>().default([]).notNull(),
    bookingRef: text('booking_ref'),
    createdAt: created(),
  },
  (t) => [uniqueIndex('push_endpoint_uq').on(t.endpoint)],
);

export const subscribers = pgTable('subscribers', {
  id: serial('id').primaryKey(),
  channel: text('channel').$type<'whatsapp' | 'email'>().notNull(),
  address: text('address').notNull(),
  source: text('source'),
  consentAt: ts('consent_at').defaultNow().notNull(),
  unsubscribedAt: ts('unsubscribed_at'),
});

export type NotificationChannel = 'email' | 'whatsapp' | 'push';
export type NotificationStatus = 'sent' | 'simulated' | 'failed';

export const notifications = pgTable(
  'notifications',
  {
    id: serial('id').primaryKey(),
    channel: text('channel').$type<NotificationChannel>().notNull(),
    to: text('to').notNull(),
    template: text('template').notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    status: text('status').$type<NotificationStatus>().notNull(),
    error: text('error'),
    bookingRef: text('booking_ref'),
    createdAt: created(),
  },
  (t) => [index('notifications_created_idx').on(t.createdAt)],
);

export const staff = pgTable(
  'staff',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    name: text('name').notNull(),
    role: text('role').$type<'admin' | 'crew'>().notNull(),
    passwordHash: text('password_hash').notNull(),
    totpSecret: text('totp_secret'),
    // Last accepted 30-second code window: a code can't be replayed.
    totpLastStep: integer('totp_last_step'),
    // Bumped on password change; sessions signed with an older version stop working.
    sessionVersion: integer('session_version').default(0).notNull(),
    lastLoginAt: ts('last_login_at'),
    createdAt: created(),
  },
  (t) => [uniqueIndex('staff_email_uq').on(t.email)],
);

export const auditLog = pgTable('audit_log', {
  id: serial('id').primaryKey(),
  staffId: uuid('staff_id'),
  staffName: text('staff_name'),
  action: text('action').notNull(),
  detail: jsonb('detail').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt: created(),
});

/** Gate sales, so the participants report covers walk-ins as well as online bookings. */
export const walkIns = pgTable(
  'walk_ins',
  {
    id: serial('id').primaryKey(),
    date: date('date', { mode: 'string' }).notNull(),
    activityId: text('activity_id').notNull(),
    qty: integer('qty').notNull(),
    amount: integer('amount_zar').notNull(),
    staffName: text('staff_name'),
    createdAt: created(),
  },
  (t) => [index('walkins_date_idx').on(t.date)],
);

/** Scream Clips and full edits, looked up by visitors on "Find my jump". */
export const clips = pgTable(
  'clips',
  {
    id: serial('id').primaryKey(),
    bookingRef: text('booking_ref').notNull(),
    kind: text('kind').$type<'scream' | 'full'>().notNull(),
    url: text('url').notNull(),
    participant: text('participant'),
    createdAt: created(),
  },
  (t) => [index('clips_ref_idx').on(t.bookingRef)],
);
