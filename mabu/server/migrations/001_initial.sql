-- Mábu — initial schema (PostgreSQL 15+).
--
-- The relational shape of src/domain/db.ts: one table per `Table` there, same
-- names. __tests__/migrations.test.ts fails if the two drift apart.
--
-- The invariants the services rely on are enforced here too, so a bug or a
-- second writer cannot break them:
--   * idempotency keys are unique per scope                 (§33)
--   * a reward ledger line is unique per account + key      (§34 exactly once)
--   * balances can never go negative                        (§48)
--   * one live notification per dedupe key                  (§42)
--   * one delivery row per message and channel              (§42 retry-safe)
--   * provider webhooks are unique per provider event id    (§33)
--   * voucher balances stay between 0 and face value
--   * event bookings never exceed capacity
--
-- Money is integer cents (ZAR). Times are timestamptz; the venue is SAST (+02:00).
-- The migration runner (server/src/migrate.ts) wraps each file in a transaction.

CREATE EXTENSION IF NOT EXISTS citext;

-- ── Guests, favourites, audit ─────────────────────────────────────────────

CREATE TABLE guest (
  id               text PRIMARY KEY,
  name             text NOT NULL DEFAULT '',
  email            citext NOT NULL UNIQUE,
  phone            text NOT NULL DEFAULT '',
  role             text NOT NULL DEFAULT 'guest' CHECK (role IN ('guest', 'staff', 'admin')),
  preferences      jsonb NOT NULL DEFAULT '{}',
  occasions        jsonb NOT NULL DEFAULT '[]',
  consent          jsonb,                         -- { marketing, updatedAt, source }
  rewards_opt_in   boolean NOT NULL DEFAULT false,
  referral_code    text UNIQUE,
  referred_by      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE favourite (
  id          text PRIMARY KEY,                    -- guestId:kind:itemId
  guest_id    text NOT NULL REFERENCES guest (id) ON DELETE CASCADE,
  kind        text NOT NULL CHECK (kind IN ('dish', 'wine', 'experience', 'collection')),
  item_id     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guest_id, kind, item_id)
);

CREATE TABLE audit_entry (
  id           text PRIMARY KEY,
  actor_id     text NOT NULL,
  actor_role   text NOT NULL,
  action       text NOT NULL,
  entity_type  text NOT NULL,
  entity_id    text NOT NULL,
  at           timestamptz NOT NULL DEFAULT now(),
  detail       jsonb
);
CREATE INDEX audit_entry_entity ON audit_entry (entity_type, entity_id);
CREATE INDEX audit_entry_at ON audit_entry (at DESC);

CREATE TABLE idempotency_record (
  id           text PRIMARY KEY,                   -- scope:key
  scope        text NOT NULL,
  key          text NOT NULL,
  fingerprint  text NOT NULL,
  result       jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (scope, key)
);

-- ── Reservations ──────────────────────────────────────────────────────────

CREATE TABLE booking_policy (
  id          text PRIMARY KEY CHECK (id = 'booking-policy'),
  version     integer NOT NULL,
  document    jsonb NOT NULL,                      -- BookingPolicy
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reservation (
  id                        text PRIMARY KEY,
  reference                 text NOT NULL UNIQUE,
  external_reservation_id   text,
  provider                  text NOT NULL CHECK (provider IN ('mabu-direct', 'dineplan')),
  status                    text NOT NULL CHECK (status IN
                              ('requested', 'confirmed', 'waitlisted', 'rescheduled', 'cancelled', 'completed', 'no-show', 'failed')),
  venue_id                  text NOT NULL,
  slot_id                   text NOT NULL,
  starts_at                 timestamptz NOT NULL,
  ends_at                   timestamptz,
  party_size                integer NOT NULL CHECK (party_size > 0),
  children                  integer NOT NULL DEFAULT 0 CHECK (children >= 0 AND children < party_size),
  guest_id                  text NOT NULL,
  guest_name                text NOT NULL,
  guest_email               text NOT NULL,
  guest_phone               text NOT NULL,
  occasion                  text,
  occasion_note             text,
  seating_preference        text,
  dietary_notes             text,
  accessibility_notes       text,
  special_request           text,
  deposit_status            text NOT NULL DEFAULT 'not_required' CHECK (deposit_status IN
                              ('not_required', 'pending', 'paid', 'failed', 'refunded', 'forfeited')),
  deposit_cents             integer NOT NULL DEFAULT 0 CHECK (deposit_cents >= 0),
  cancellation_reason       text,
  policy_outcome            text,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_reservation_id)
);
CREATE INDEX reservation_guest ON reservation (guest_id, starts_at);
CREATE INDEX reservation_day ON reservation (starts_at);

-- §30: internal notes live apart from the guest-visible record.
CREATE TABLE staff_note (
  id              text PRIMARY KEY,
  reservation_id  text NOT NULL REFERENCES reservation (id) ON DELETE CASCADE,
  author_id       text NOT NULL,
  body            text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reservation_event (
  id                 text PRIMARY KEY,
  reservation_id     text NOT NULL REFERENCES reservation (id) ON DELETE CASCADE,
  event_type         text NOT NULL,
  payload            jsonb NOT NULL DEFAULT '{}',
  occurred_at        timestamptz NOT NULL DEFAULT now(),
  actor_id           text NOT NULL,
  provider_event_id  text
);
CREATE INDEX reservation_event_reservation ON reservation_event (reservation_id, occurred_at);

CREATE TABLE waitlist_entry (
  id                  text PRIMARY KEY,
  guest_id            text NOT NULL,
  query               jsonb NOT NULL,              -- AvailabilityQuery + preferredTime
  status              text NOT NULL CHECK (status IN ('waiting', 'matched', 'booked', 'expired', 'cancelled')),
  created_at          timestamptz NOT NULL DEFAULT now(),
  matched_at          timestamptz,
  matched_slot_id     text,
  matched_starts_at   timestamptz
);
CREATE INDEX waitlist_waiting ON waitlist_entry ((query ->> 'date')) WHERE status = 'waiting';

CREATE TABLE provider_webhook_event (
  id                 text PRIMARY KEY,             -- provider:providerEventId
  provider           text NOT NULL,
  provider_event_id  text NOT NULL,
  type               text NOT NULL,
  payload            jsonb NOT NULL,
  received_at        timestamptz NOT NULL DEFAULT now(),
  processed_at       timestamptz,
  UNIQUE (provider, provider_event_id)
);

-- ── Rewards ───────────────────────────────────────────────────────────────

CREATE TABLE reward_tier (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  min_lifetime_points  integer NOT NULL CHECK (min_lifetime_points >= 0),
  "order"              integer NOT NULL UNIQUE,
  benefits             jsonb NOT NULL DEFAULT '[]'
);

CREATE TABLE reward_account (
  id              text PRIMARY KEY,
  guest_id        text NOT NULL UNIQUE,
  tier_id         text NOT NULL REFERENCES reward_tier (id),
  balance_points  integer NOT NULL DEFAULT 0 CHECK (balance_points >= 0),
  lifetime_points integer NOT NULL DEFAULT 0 CHECK (lifetime_points >= 0),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reward_rule (
  id                   text PRIMARY KEY,
  name                 text NOT NULL,
  trigger              text NOT NULL CHECK (trigger IN
                         ('completed_visit', 'event_attendance', 'purchase', 'referral', 'birthday', 'campaign')),
  points               integer NOT NULL CHECK (points >= 0),
  points_per_100_rand  integer CHECK (points_per_100_rand >= 0),
  active               boolean NOT NULL DEFAULT true,
  starts_at            timestamptz,
  ends_at              timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reward (
  id                     text PRIMARY KEY,
  name                   text NOT NULL,
  description            text NOT NULL,
  terms                  text NOT NULL,
  kind                   text NOT NULL,
  points_cost            integer NOT NULL CHECK (points_cost > 0),
  tier_ids               text[],
  expires_at             timestamptz,
  redemption_valid_days  integer NOT NULL CHECK (redemption_valid_days > 0),
  active                 boolean NOT NULL DEFAULT true,
  photo                  text
);

-- The ledger. Append-only: corrections are 'reverse' lines, never updates to
-- points. `remaining_points` on earn lines is the FIFO lot balance.
CREATE TABLE reward_transaction (
  id                       text PRIMARY KEY,
  account_id               text NOT NULL REFERENCES reward_account (id),
  type                     text NOT NULL CHECK (type IN ('earn', 'redeem', 'adjust', 'expire', 'reverse')),
  points                   integer NOT NULL CHECK (points <> 0),
  reference_type           text NOT NULL,
  reference_id             text NOT NULL,
  idempotency_key          text NOT NULL,
  description              text NOT NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  expires_at               timestamptz,
  remaining_points         integer CHECK (remaining_points >= 0),
  reverses_transaction_id  text UNIQUE REFERENCES reward_transaction (id),
  actor_id                 text NOT NULL,
  UNIQUE (account_id, idempotency_key)
);
CREATE INDEX reward_transaction_lots ON reward_transaction (account_id, expires_at) WHERE remaining_points > 0;

CREATE TABLE reward_redemption (
  id              text PRIMARY KEY,
  account_id      text NOT NULL REFERENCES reward_account (id),
  guest_id        text NOT NULL,
  reward_id       text NOT NULL REFERENCES reward (id),
  reward_name     text NOT NULL,
  code            text NOT NULL UNIQUE,
  status          text NOT NULL CHECK (status IN ('issued', 'used', 'cancelled', 'expired')),
  transaction_id  text NOT NULL UNIQUE REFERENCES reward_transaction (id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  used_at         timestamptz,
  used_by         text
);

CREATE TABLE rewards_settings (
  id          text PRIMARY KEY CHECK (id = 'rewards-settings'),
  document    jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Notifications ─────────────────────────────────────────────────────────

CREATE TABLE notification_preference (
  id                 text PRIMARY KEY,             -- guestId:category
  guest_id           text NOT NULL,
  category           text NOT NULL CHECK (category IN ('booking', 'event', 'rewards', 'voucher', 'service', 'marketing')),
  enabled            boolean NOT NULL,
  channels           text[] NOT NULL,
  quiet_hours        jsonb,
  consent_timestamp  timestamptz,
  consent_source     text,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guest_id, category)
);

CREATE TABLE notification_template (
  id          text PRIMARY KEY,                    -- key:channel:vN
  key         text NOT NULL,
  channel     text NOT NULL CHECK (channel IN ('push', 'email', 'sms', 'whatsapp', 'in-app')),
  subject     text,
  body        text NOT NULL,
  version     integer NOT NULL CHECK (version > 0),
  active      boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  text NOT NULL,
  UNIQUE (key, channel, version)
);
CREATE UNIQUE INDEX notification_template_one_active ON notification_template (key, channel) WHERE active;

CREATE TABLE notification_message (
  id                 text PRIMARY KEY,
  guest_id           text NOT NULL,
  category           text NOT NULL,
  template_key       text NOT NULL,
  data               jsonb NOT NULL DEFAULT '{}',
  channels           text[] NOT NULL,
  scheduled_for      timestamptz,
  deep_link          text,
  dedupe_key         text NOT NULL,
  urgent             boolean NOT NULL DEFAULT false,
  status             text NOT NULL CHECK (status IN
                       ('scheduled', 'queued', 'sent', 'partially_sent', 'failed', 'cancelled', 'suppressed')),
  suppressed_reason  text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  sent_at            timestamptz
);
CREATE UNIQUE INDEX notification_message_live_dedupe ON notification_message (dedupe_key) WHERE status <> 'cancelled';
CREATE INDEX notification_message_due ON notification_message (scheduled_for) WHERE status = 'scheduled';

CREATE TABLE notification_delivery (
  id                   text PRIMARY KEY,           -- messageId:channel
  notification_id      text NOT NULL REFERENCES notification_message (id) ON DELETE CASCADE,
  channel              text NOT NULL,
  provider_message_id  text,
  status               text NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'skipped')),
  attempts             integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error           text,
  next_attempt_at      timestamptz,
  sent_at              timestamptz,
  template_version     integer,
  UNIQUE (notification_id, channel)
);
CREATE INDEX notification_delivery_retry ON notification_delivery (next_attempt_at) WHERE status = 'pending';

CREATE TABLE inbox_item (
  id               text PRIMARY KEY,
  guest_id         text NOT NULL,
  notification_id  text NOT NULL UNIQUE,
  category         text NOT NULL,
  title            text NOT NULL,
  body             text NOT NULL,
  deep_link        text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  read_at          timestamptz
);
CREATE INDEX inbox_item_guest ON inbox_item (guest_id, created_at DESC);

CREATE TABLE campaign (
  id                  text PRIMARY KEY,
  name                text NOT NULL,
  template_key        text NOT NULL,
  data                jsonb NOT NULL,
  deep_link           text,
  scheduled_for       timestamptz NOT NULL,
  status              text NOT NULL CHECK (status IN ('scheduled', 'sent', 'cancelled')),
  created_by          text NOT NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  sent_at             timestamptz,
  recipients          integer,
  blocked_no_consent  integer
);

-- ── Events ────────────────────────────────────────────────────────────────

CREATE TABLE experience (
  id                    text PRIMARY KEY,
  title                 text NOT NULL,
  subtitle              text NOT NULL DEFAULT '',
  kind                  text NOT NULL,
  starts_at             timestamptz NOT NULL,
  ends_at               timestamptz NOT NULL CHECK (ends_at > starts_at),
  room                  text NOT NULL,
  price_cents           integer CHECK (price_cents >= 0),     -- NULL = price on request
  capacity              integer NOT NULL CHECK (capacity >= 0),
  seats_booked          integer NOT NULL DEFAULT 0 CHECK (seats_booked >= 0 AND seats_booked <= capacity),
  max_seats_per_booking integer NOT NULL CHECK (max_seats_per_booking > 0),
  waitlist_enabled      boolean NOT NULL DEFAULT false,
  description           text NOT NULL,
  menu_teaser           jsonb,
  wine_partner          text,
  dress_code            text,
  age_rule              text,
  hero_photo            text NOT NULL,
  booking_required      boolean NOT NULL DEFAULT true,
  published             boolean NOT NULL DEFAULT false,
  is_sample             boolean NOT NULL DEFAULT false,
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE experience_booking (
  id            text PRIMARY KEY,
  reference     text NOT NULL UNIQUE,
  event_id      text NOT NULL REFERENCES experience (id),
  guest_id      text NOT NULL,
  seats         integer NOT NULL CHECK (seats > 0),
  status        text NOT NULL CHECK (status IN ('pending_payment', 'confirmed', 'waitlisted', 'cancelled', 'attended', 'no-show')),
  amount_cents  integer NOT NULL CHECK (amount_cents >= 0),
  payment_id    text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- ── Vouchers & payments ───────────────────────────────────────────────────

CREATE TABLE voucher_policy (
  id          text PRIMARY KEY CHECK (id = 'voucher-policy'),
  document    jsonb NOT NULL,
  -- CPA s63: prepaid certificates are valid for at least three years.
  expiry_months integer NOT NULL CHECK (expiry_months >= 36),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE voucher (
  id                  text PRIMARY KEY,
  code                text NOT NULL UNIQUE,
  amount_cents        integer NOT NULL CHECK (amount_cents > 0),
  remaining_cents     integer NOT NULL CHECK (remaining_cents >= 0 AND remaining_cents <= amount_cents),
  status              text NOT NULL CHECK (status IN ('pending_payment', 'active', 'redeemed', 'expired', 'cancelled')),
  purchaser_guest_id  text NOT NULL,
  issued_to           text,
  recipient_name      text NOT NULL,
  recipient_email     citext NOT NULL,
  for_self            boolean NOT NULL,
  message             text,
  occasion            text,
  delivery            text NOT NULL CHECK (delivery IN ('email', 'in-app')),
  payment_id          text,
  issued_at           timestamptz,
  expires_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX voucher_recipient ON voucher (recipient_email);

CREATE TABLE voucher_redemption (
  id               text PRIMARY KEY,
  voucher_id       text NOT NULL REFERENCES voucher (id),
  amount_cents     integer NOT NULL CHECK (amount_cents > 0),
  staff_id         text NOT NULL,
  idempotency_key  text NOT NULL,
  note             text,
  at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (voucher_id, idempotency_key)
);

CREATE TABLE payment_intent (
  id               text PRIMARY KEY,
  purpose          text NOT NULL CHECK (purpose IN ('voucher', 'event', 'deposit')),
  reference_id     text NOT NULL,
  amount_cents     integer NOT NULL CHECK (amount_cents > 0),
  currency         text NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status           text NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  provider         text NOT NULL,
  provider_ref     text,
  failure_reason   text,
  idempotency_key  text NOT NULL UNIQUE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX payment_intent_pending ON payment_intent (created_at) WHERE status = 'pending';

-- ── Content (CMS) ─────────────────────────────────────────────────────────

CREATE TABLE menu_item (
  id           text PRIMARY KEY,
  category     text NOT NULL,
  price_cents  integer NOT NULL CHECK (price_cents >= 0),
  available    boolean NOT NULL DEFAULT true,
  is_sample    boolean NOT NULL DEFAULT false,
  document     jsonb NOT NULL,                     -- Dish
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wine_item (
  id                  text PRIMARY KEY,
  style               text NOT NULL,
  bottle_price_cents  integer NOT NULL CHECK (bottle_price_cents >= 0),
  glass_price_cents   integer CHECK (glass_price_cents >= 0),
  available           boolean NOT NULL DEFAULT true,
  is_sample           boolean NOT NULL DEFAULT false,
  document            jsonb NOT NULL,              -- WineItem
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE menu_collection (
  id        text PRIMARY KEY,
  document  jsonb NOT NULL                          -- MenuCollection
);

CREATE TABLE venue (
  id          text PRIMARY KEY CHECK (id = 'venue'),
  document    jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE home_content (
  id          text PRIMARY KEY CHECK (id = 'home'),
  document    jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Optional commerce (§13–15) ────────────────────────────────────────────

CREATE TABLE provider_order (
  id                 text PRIMARY KEY,
  provider           text NOT NULL CHECK (provider IN ('mabu-direct', 'uber-eats', 'mr-d')),
  external_order_id  text NOT NULL,
  status             text NOT NULL,
  request            jsonb NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, external_order_id)
);
