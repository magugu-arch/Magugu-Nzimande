-- Content management: stored entries that override the seed, and the public
-- files (cover art, audio previews, captions, the rider) they point at.

CREATE TABLE IF NOT EXISTS content_entries (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL CHECK (collection IN ('albums', 'videos', 'stories', 'pillars', 'pressKit', 'settings')),
  slug TEXT NOT NULL,
  data JSONB NOT NULL,
  archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  updated_by TEXT NOT NULL,
  CHECK (id = collection || ':' || slug)
);
CREATE INDEX IF NOT EXISTS content_entries_collection_idx ON content_entries (collection, created_at DESC);

CREATE TABLE IF NOT EXISTS public_assets (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('image', 'audio', 'document', 'captions')),
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL CHECK (size > 0),
  storage_key TEXT NOT NULL,
  width INTEGER,
  height INTEGER,
  label TEXT NOT NULL,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

-- Proposals move through new → reviewed → archived in the inbox.
UPDATE collaboration_requests SET status = 'new' WHERE status NOT IN ('new', 'reviewed', 'archived');
ALTER TABLE collaboration_requests DROP CONSTRAINT IF EXISTS collaboration_requests_status_check;
ALTER TABLE collaboration_requests ADD CONSTRAINT collaboration_requests_status_check CHECK (status IN ('new', 'reviewed', 'archived'));
