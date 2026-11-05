-- Admin alerts get their own "last seen" time, so opening the admin bell doesn't clear the
-- regular inbox (and the other way round). Additive only.
ALTER TABLE notification_seen ADD COLUMN IF NOT EXISTS admin_seen_at timestamp;
