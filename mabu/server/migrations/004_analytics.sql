-- 004: funnel events (§27, §47), so the conversion counts the restaurant sees
-- survive a restart. No name, email, phone or address is ever written here:
-- guest_id is an opaque internal id, and props holds primitives only.

CREATE TABLE analytics_event (
  id          text PRIMARY KEY,
  event       text NOT NULL,
  props       jsonb NOT NULL DEFAULT '{}'::jsonb,
  at          timestamptz NOT NULL,
  guest_id    text,
  platform    text CHECK (platform IN ('ios', 'android', 'web', 'server'))
);
CREATE INDEX analytics_event_at ON analytics_event (at DESC);
CREATE INDEX analytics_event_name_at ON analytics_event (event, at DESC);
