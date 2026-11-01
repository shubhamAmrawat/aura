-- Notifications (phase 1): the in-app/website inbox plus app push via Expo.
--  push_devices: one row per phone (Expo push token). user_id is null when signed out, so drops
--    and the daily pick still reach signed-out phones. prefs = per-type switches from Settings.
--  notifications: user_id set = personal (upload approved, report reviewed, ...);
--    user_id null = broadcast to everyone (drop live, daily pick, app update). dedupe_key stops a
--    second send of the same event. screen limits a broadcast to one device shape (daily pick).
--  notification_seen: per user, when they last opened the inbox (older items count as seen).
-- Additive only.
CREATE TABLE IF NOT EXISTS push_devices (
  token text PRIMARY KEY,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  platform text NOT NULL DEFAULT 'android',
  screen text NOT NULL DEFAULT 'mobile' CHECK (screen IN ('mobile', 'tablet')),
  app_version text,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now(),
  disabled_at timestamp
);
CREATE INDEX IF NOT EXISTS push_devices_user_idx ON push_devices (user_id) WHERE disabled_at IS NULL;

CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  body text,
  image_url text,
  url text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  screen text CHECK (screen IS NULL OR screen IN ('mobile', 'tablet')),
  dedupe_key text UNIQUE,
  pushed integer NOT NULL DEFAULT 0,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notifications_user_created_idx ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_broadcast_created_idx ON notifications (created_at DESC) WHERE user_id IS NULL;

CREATE TABLE IF NOT EXISTS notification_seen (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  seen_at timestamp NOT NULL DEFAULT now()
);
