-- Notification templates: reusable messages for Admin › Notifications › Templates.
-- Built-ins have a key (seeded by the API on first use; "Reset" restores them); custom ones don't.
-- Campaigns remember which template they came from, for the per-template cooldown.
-- Additive only.
CREATE TABLE IF NOT EXISTS notification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE,
  category text NOT NULL,
  name text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'announcement',
  title text NOT NULL,
  body text,
  image_source text NOT NULL DEFAULT 'none' CHECK (image_source IN ('none', 'custom', 'drop', 'wallpaper')),
  image_url text,
  url text,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience jsonb NOT NULL DEFAULT '{"kind":"everyone"}'::jsonb,
  best_time text,
  cooldown_days integer NOT NULL DEFAULT 0,
  builtin boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  archived_at timestamp
);

ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES notification_templates(id) ON DELETE SET NULL;
ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS cooldown_days integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS notification_campaigns_template_idx ON notification_campaigns (template_id, created_at) WHERE template_id IS NOT NULL;
