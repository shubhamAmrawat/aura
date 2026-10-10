-- Admin dashboard, Phase 1. Additive only: safe while the current API is running.
BEGIN;

ALTER TABLE users ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'user';
DO $$ BEGIN
  ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS moderation_reason text;
ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS reviewed_by uuid;
ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS reviewed_at timestamp;
ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS rejected_at timestamp;
DO $$ BEGIN
  ALTER TABLE wallpapers ADD CONSTRAINT wallpapers_reviewed_by_users_id_fk
    FOREIGN KEY (reviewed_by) REFERENCES users(id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid CONSTRAINT admin_actions_admin_id_users_id_fk REFERENCES users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target_type text,
  target_id text,
  details jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallpapers_status_created_at_idx ON wallpapers (status, created_at);
CREATE INDEX IF NOT EXISTS downloads_created_at_idx ON downloads (created_at);
CREATE INDEX IF NOT EXISTS admin_actions_created_at_idx ON admin_actions (created_at);

COMMIT;
