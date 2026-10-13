-- Disable (suspend) accounts. Additive only.
-- A disabled user can't sign in, their sessions stop working, and their live wallpapers
-- are set to the new 'hidden' status (restored to 'approved' when re-enabled).
ALTER TYPE wallpaper_status ADD VALUE IF NOT EXISTS 'hidden';

BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_reason text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS disabled_by uuid CONSTRAINT users_disabled_by_users_id_fk REFERENCES users(id) ON DELETE SET NULL;
COMMIT;
