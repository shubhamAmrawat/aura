-- Notification expiry: a send can end (e.g. when its drop ends). Expired sends aren't pushed
-- any more, and inbox items show "Ended" (and drop out of the inbox a few days later).
-- Additive only.
ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS expires_at timestamp;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at timestamp;
