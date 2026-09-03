-- bb.q Chicken South Africa — ordering website
-- Migration 001: the shape the JSON state file is standing in for.
--
-- Not applied by anything yet: no database has been provisioned, and doing so
-- is a hosting decision rather than an engineering one. It is written now
-- because the JSON store's shape is the de facto schema already, and the longer
-- that goes unwritten the more it drifts into something no relational model
-- fits. A test reads this file and checks it against the TypeScript state
-- shape, so the two cannot disagree quietly.
--
-- Money is integer cents throughout. NUMERIC would also be correct; FLOAT never
-- is, and naming that here is cheaper than finding a rounding error in a total.

-- ---------------------------------------------------------------------------
-- Catalogue availability, as the operations console writes it
-- ---------------------------------------------------------------------------

-- The seed catalogue is not in the database. It is version-controlled data that
-- deploys with the code, and the franchisor owns it; what belongs here is only
-- what an operator changes during a service.
CREATE TABLE product_availability (
  slug          TEXT PRIMARY KEY,
  sold_out      BOOLEAN NOT NULL DEFAULT FALSE,
  hidden        BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE store_services (
  store_id      TEXT NOT NULL,
  mode          TEXT NOT NULL CHECK (mode IN ('Delivery', 'Collection', 'Dine-in')),
  enabled       BOOLEAN NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (store_id, mode)
);

-- ---------------------------------------------------------------------------
-- Customers
-- ---------------------------------------------------------------------------

CREATE TABLE accounts (
  id            TEXT PRIMARY KEY,
  -- Lower-cased, and unique. This is the index the JSON store cannot have, and
  -- the reason register() has to check twice: two sign-ups racing on one
  -- address both see an empty result there. Here the second one simply fails.
  email_key     TEXT NOT NULL UNIQUE,
  email         TEXT NOT NULL,
  name          TEXT NOT NULL,
  mobile        TEXT NOT NULL,
  -- scrypt output and the parameters it was made with, so the cost can be
  -- raised later without invalidating every existing password.
  password_hash TEXT NOT NULL,
  points        INTEGER NOT NULL DEFAULT 0 CHECK (points >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE account_addresses (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,
  address       TEXT NOT NULL,
  suburb        TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT ''
);

CREATE INDEX account_addresses_by_account ON account_addresses (account_id);

-- Only the hash of a reset token, never the token. A leaked copy of this table
-- is then a list of useless strings rather than a way into every account on it.
CREATE TABLE password_resets (
  token_hash    TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  expires_at    TIMESTAMPTZ NOT NULL
);

-- One live reset per account, so a customer who clicks twice cannot be confused
-- about which link works and nobody can bank a supply of them.
CREATE UNIQUE INDEX password_resets_one_per_account ON password_resets (account_id);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------

CREATE TABLE orders (
  id                TEXT PRIMARY KEY,
  order_number      TEXT NOT NULL UNIQUE,
  store_id          TEXT NOT NULL,
  mode              TEXT NOT NULL CHECK (mode IN ('Delivery', 'Collection', 'Dine-in')),
  status            TEXT NOT NULL CHECK (
                      status IN ('received', 'preparing', 'ready', 'out_for_delivery',
                                 'completed', 'cancelled')),
  -- Required when status is cancelled and null otherwise: the rule the order
  -- store enforces in code, stated here so a hand-written UPDATE cannot skip it.
  cancelled_reason  TEXT CHECK (
                      (status = 'cancelled' AND cancelled_reason IS NOT NULL)
                      OR (status <> 'cancelled' AND cancelled_reason IS NULL)),
  -- ON DELETE SET NULL, not CASCADE. Erasing a customer must not destroy the
  -- sale: a completed transaction is a record the business is required to keep,
  -- and honouring one obligation by breaching another is not compliance.
  account_id        TEXT REFERENCES accounts(id) ON DELETE SET NULL,
  customer_name     TEXT NOT NULL,
  customer_email    TEXT NOT NULL,
  customer_mobile   TEXT NOT NULL,
  placed_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  eta_minutes       INTEGER NOT NULL CHECK (eta_minutes > 0),
  promo_code        TEXT,
  address           TEXT,
  kitchen_note      TEXT NOT NULL DEFAULT '',
  subtotal_cents    INTEGER NOT NULL CHECK (subtotal_cents >= 0),
  discount_cents    INTEGER NOT NULL CHECK (discount_cents >= 0),
  delivery_cents    INTEGER NOT NULL CHECK (delivery_cents >= 0),
  total_cents       INTEGER NOT NULL CHECK (total_cents >= 0),
  points_earned     INTEGER NOT NULL DEFAULT 0 CHECK (points_earned >= 0)
);

CREATE INDEX orders_by_account ON orders (account_id, placed_at DESC);
CREATE INDEX orders_by_status ON orders (status, placed_at DESC);

CREATE TABLE order_lines (
  id            BIGSERIAL PRIMARY KEY,
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  -- Product identity plus the specific option selection, so two lines of the
  -- same product with different options stay separate.
  line_key      TEXT NOT NULL,
  slug          TEXT NOT NULL,
  name          TEXT NOT NULL,
  image_key     TEXT NOT NULL,
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  -- The price the server decided, not the one the client sent.
  unit_cents    INTEGER NOT NULL CHECK (unit_cents >= 0),
  options       JSONB NOT NULL DEFAULT '[]'::JSONB
);

CREATE INDEX order_lines_by_order ON order_lines (order_id);

-- ---------------------------------------------------------------------------
-- Payments
-- ---------------------------------------------------------------------------

CREATE TABLE payment_intents (
  id              TEXT PRIMARY KEY,
  -- One open payment per order. A second intent against an order already being
  -- paid is how a customer pays twice for one meal, and here it is impossible
  -- rather than merely checked.
  order_id        TEXT NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
  amount_cents    INTEGER NOT NULL CHECK (amount_cents >= 0),
  currency        TEXT NOT NULL DEFAULT 'ZAR' CHECK (currency = 'ZAR'),
  status          TEXT NOT NULL CHECK (
                    status IN ('pending', 'authorised', 'captured', 'failed', 'refunded')),
  provider        TEXT NOT NULL,
  provider_ref    TEXT,
  failure_reason  TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The idempotency key, as a primary key rather than a list to search. A
-- redelivered callback is a duplicate insert, which fails, which is the whole
-- mechanism — no read-then-write, and therefore no window between them.
CREATE TABLE payment_events_applied (
  event_id      TEXT PRIMARY KEY,
  intent_id     TEXT NOT NULL REFERENCES payment_intents(id) ON DELETE CASCADE,
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Messages and handoffs
-- ---------------------------------------------------------------------------

CREATE TABLE notifications_sent (
  message_id    TEXT PRIMARY KEY,
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE fulfilment_handoffs (
  order_id      TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  kind          TEXT NOT NULL CHECK (kind IN ('pos', 'courier')),
  adapter       TEXT NOT NULL,
  ok            BOOLEAN NOT NULL,
  reference     TEXT,
  error         TEXT,
  retryable     BOOLEAN NOT NULL DEFAULT FALSE,
  at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One record per order per kind, updated in place. The end-of-service
  -- question is which orders the kitchen never saw, not how many times we asked.
  PRIMARY KEY (order_id, kind)
);

CREATE INDEX fulfilment_unacknowledged ON fulfilment_handoffs (kind, at DESC) WHERE NOT ok;

-- ---------------------------------------------------------------------------
-- Console
-- ---------------------------------------------------------------------------

CREATE TABLE console_lock (
  id            BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id),
  failures      INTEGER NOT NULL DEFAULT 0 CHECK (failures >= 0),
  locked_until  TIMESTAMPTZ
);

CREATE TABLE audit_log (
  id            BIGSERIAL PRIMARY KEY,
  at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  who           TEXT NOT NULL,
  what          TEXT NOT NULL
);

CREATE INDEX audit_log_newest ON audit_log (at DESC);
