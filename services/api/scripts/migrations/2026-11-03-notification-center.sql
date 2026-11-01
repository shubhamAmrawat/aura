-- Notification center: every send (manual or automatic) is a campaign; each phone/browser it goes
-- to is a delivery row (queued → sent → delivered/failed, opened). Web push subscriptions for the
-- website. Rules (quiet hours, daily cap, automatic switches) live in site_settings.
-- Additive only.
CREATE TABLE IF NOT EXISTS notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'manual' CHECK (kind IN ('manual', 'auto', 'test')),
  type text NOT NULL,
  title text NOT NULL,
  body text,
  image_url text,
  url text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience jsonb NOT NULL DEFAULT '{}'::jsonb,
  respect_quiet boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'held', 'sending', 'sent', 'cancelled')),
  scheduled_for timestamp NOT NULL DEFAULT now(),
  dedupe_key text UNIQUE,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  started_at timestamp,
  finished_at timestamp,
  targeted integer NOT NULL DEFAULT 0,
  sent integer NOT NULL DEFAULT 0,
  delivered integer NOT NULL DEFAULT 0,
  failed integer NOT NULL DEFAULT 0,
  capped integer NOT NULL DEFAULT 0,
  opened integer NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS notification_campaigns_due_idx ON notification_campaigns (scheduled_for) WHERE status IN ('scheduled', 'held');
CREATE INDEX IF NOT EXISTS notification_campaigns_created_idx ON notification_campaigns (created_at DESC);

CREATE TABLE IF NOT EXISTS notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('app', 'web')),
  target text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'capped')),
  ticket_id text,
  error text,
  created_at timestamp NOT NULL DEFAULT now(),
  sent_at timestamp,
  checked_at timestamp,
  opened_at timestamp,
  action text
);
CREATE INDEX IF NOT EXISTS notification_deliveries_campaign_idx ON notification_deliveries (campaign_id);
CREATE INDEX IF NOT EXISTS notification_deliveries_queued_idx ON notification_deliveries (created_at) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS notification_deliveries_receipts_idx ON notification_deliveries (sent_at) WHERE status = 'sent' AND ticket_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notification_deliveries_target_idx ON notification_deliveries (target, sent_at);
CREATE INDEX IF NOT EXISTS notification_deliveries_user_idx ON notification_deliveries (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  endpoint text PRIMARY KEY,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  user_agent text,
  prefs jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  last_seen_at timestamp NOT NULL DEFAULT now(),
  disabled_at timestamp
);
CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_idx ON web_push_subscriptions (user_id) WHERE disabled_at IS NULL;

ALTER TABLE push_devices ADD COLUMN IF NOT EXISTS device_name text;
ALTER TABLE push_devices ADD COLUMN IF NOT EXISTS os_version text;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES notification_campaigns(id) ON DELETE SET NULL;
