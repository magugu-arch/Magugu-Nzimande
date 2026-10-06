-- Zakes Bantwini — booking and CMS operational schema.
-- Mirrors src/lib/store/types.ts (TABLES). Apply with `npm run db:migrate`.
-- Money is stored in integer cents (BIGINT); days as DATE; moments as TIMESTAMPTZ.

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS reference_counters (
  year INTEGER PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  organisation TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp_opt_in BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS customers_email_idx ON customers (lower(email));

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  kind TEXT NOT NULL CHECK (kind IN ('private', 'public')),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  start_time TEXT,
  end_time TEXT,
  venue TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  ticket_url TEXT,
  description TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS events_date_idx ON events (date);
CREATE INDEX IF NOT EXISTS events_public_idx ON events (kind, published, date);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL UNIQUE CHECK (reference ~ '^ZB-[0-9]{4}-[0-9]{4,}$'),
  customer_id TEXT NOT NULL REFERENCES customers (id),
  event_id TEXT NOT NULL REFERENCES events (id),
  status TEXT NOT NULL CHECK (status IN ('NEW', 'IN_REVIEW', 'QUOTE_SENT', 'ON_HOLD', 'AWAITING_DEPOSIT', 'CONFIRMED', 'COMPLETED', 'CANCELLED')),
  event_type TEXT NOT NULL,
  performance_format TEXT NOT NULL,
  budget_range TEXT NOT NULL,
  expected_attendance INTEGER NOT NULL CHECK (expected_attendance > 0),
  travel_required BOOLEAN NOT NULL,
  travel_notes TEXT,
  accommodation_required BOOLEAN NOT NULL,
  accommodation_notes TEXT,
  production_notes TEXT,
  additional_info TEXT,
  portal_token_hash TEXT NOT NULL UNIQUE,
  hold_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS bookings_status_idx ON bookings (status, created_at DESC);
-- events.booking_id is deliberately not a foreign key: the event row is written
-- first (bookings.event_id references it), and public shows have no booking.

CREATE TABLE IF NOT EXISTS availability (
  date DATE PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('AVAILABLE', 'ON_HOLD', 'CONFIRMED', 'TRAVEL', 'UNAVAILABLE')),
  booking_id TEXT REFERENCES bookings (id) ON DELETE SET NULL,
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS quotes (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  version INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'accepted', 'changes_requested', 'superseded')),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  lines JSONB NOT NULL,
  tax_applicable BOOLEAN NOT NULL,
  tax_rate_bps INTEGER NOT NULL,
  subtotal_cents BIGINT NOT NULL,
  tax_cents BIGINT NOT NULL,
  total_cents BIGINT NOT NULL,
  deposit_percent INTEGER NOT NULL CHECK (deposit_percent BETWEEN 0 AND 100),
  deposit_cents BIGINT NOT NULL,
  balance_cents BIGINT NOT NULL,
  deposit_due_date DATE NOT NULL,
  balance_due_date DATE,
  valid_until DATE NOT NULL,
  cancellation_terms TEXT NOT NULL,
  client_message TEXT,
  client_response_note TEXT,
  created_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  UNIQUE (booking_id, version),
  CHECK (deposit_cents + balance_cents = total_cents)
);

CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  quote_id TEXT NOT NULL REFERENCES quotes (id),
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'signed', 'void')),
  terms TEXT NOT NULL,
  terms_hash TEXT NOT NULL,
  signer_name TEXT,
  signer_ip_hash TEXT,
  signed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  quote_id TEXT NOT NULL REFERENCES quotes (id),
  kind TEXT NOT NULL CHECK (kind IN ('deposit', 'balance')),
  provider TEXT NOT NULL,
  merchant_reference TEXT NOT NULL UNIQUE,
  provider_reference TEXT,
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'ZAR',
  status TEXT NOT NULL CHECK (status IN ('pending', 'complete', 'failed', 'cancelled', 'refunded')),
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS payments_booking_idx ON payments (booking_id);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  booking_id TEXT REFERENCES bookings (id),
  event TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'whatsapp')),
  audience TEXT NOT NULL CHECK (audience IN ('client', 'management')),
  recipient TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped', 'logged')),
  provider TEXT NOT NULL,
  provider_id TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_booking_idx ON notifications (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  kind TEXT NOT NULL CHECK (kind IN ('brief', 'agreement', 'rider', 'receipt', 'other')),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  storage_key TEXT NOT NULL,
  uploaded_by TEXT NOT NULL CHECK (uploaded_by IN ('client', 'admin')),
  client_visible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'manager', 'viewer')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  last_login_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS internal_notes (
  id TEXT PRIMARY KEY,
  booking_id TEXT NOT NULL REFERENCES bookings (id),
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  booking_id TEXT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS audit_booking_idx ON audit_log (booking_id, created_at DESC);

CREATE TABLE IF NOT EXISTS community_signups (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  phone TEXT,
  email_consent BOOLEAN NOT NULL,
  whatsapp_consent BOOLEAN NOT NULL,
  consent_text TEXT NOT NULL,
  source TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS collaboration_requests (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  organisation TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  timeline TEXT,
  budget TEXT,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL
);
