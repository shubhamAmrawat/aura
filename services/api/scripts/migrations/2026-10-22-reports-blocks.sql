-- Reporting and blocking (Google Play UGC policy): anyone can report a wallpaper or a creator; admins
-- review reports in the dashboard. Signed-in users can block a creator, which hides their wallpapers
-- for that user in the app. Additive only.
CREATE TABLE IF NOT EXISTS content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('wallpaper', 'user')),
  wallpaper_id uuid REFERENCES wallpapers(id) ON DELETE SET NULL,
  reported_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  target_label text,
  reason text NOT NULL CHECK (reason IN ('nudity', 'violence', 'hate', 'harassment', 'copyright', 'spam', 'impersonation', 'other')),
  details text,
  source text NOT NULL DEFAULT 'unknown',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'actioned', 'dismissed')),
  resolved_by uuid REFERENCES users(id) ON DELETE SET NULL,
  resolved_at timestamp,
  resolution_note text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS content_reports_status_created_idx ON content_reports (status, created_at);
CREATE INDEX IF NOT EXISTS content_reports_wallpaper_idx ON content_reports (wallpaper_id);
CREATE INDEX IF NOT EXISTS content_reports_reported_user_idx ON content_reports (reported_user_id);

CREATE TABLE IF NOT EXISTS user_blocks (
  blocker_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX IF NOT EXISTS user_blocks_blocked_idx ON user_blocks (blocked_id);
