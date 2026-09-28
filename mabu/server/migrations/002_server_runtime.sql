-- 002: push devices (§37) and the tables the Mábu API server runs on.

CREATE TABLE push_token (
  id            text PRIMARY KEY,                  -- the Expo push token
  guest_id      text NOT NULL REFERENCES guest (id) ON DELETE CASCADE,
  platform      text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at    timestamptz NOT NULL,
  last_seen_at  timestamptz NOT NULL
);
CREATE INDEX push_token_guest ON push_token (guest_id);

-- ── Server runtime (server/src) ───────────────────────────────────────────
-- The server keeps the service layer's rows as documents, written through
-- after every call. Moving each table onto its relational shape in 001 is
-- the next step; the documents already match those shapes field for field.

CREATE TABLE server_row (
  table_name  text NOT NULL,
  id          text NOT NULL,
  document    jsonb NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, id)
);

-- Sign-in: one live code per address, stored hashed, with an attempt count.
CREATE TABLE server_otp (
  email       citext PRIMARY KEY,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  sent_at     timestamptz NOT NULL DEFAULT now()
);

-- Sessions: only a hash of the bearer token is kept.
CREATE TABLE server_session (
  token_hash    text PRIMARY KEY,
  guest_id      text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX server_session_guest ON server_session (guest_id);
