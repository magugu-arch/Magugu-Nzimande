-- 003: what a session remembers about itself, so a guest can see where they
-- are signed in and end a session they do not recognise, and so a staff
-- session cannot live as long as a guest's.

ALTER TABLE server_session ADD COLUMN absolute_expires_at timestamptz;
ALTER TABLE server_session ADD COLUMN role text;
ALTER TABLE server_session ADD COLUMN label text;
ALTER TABLE server_session ADD COLUMN ip_hash text;
