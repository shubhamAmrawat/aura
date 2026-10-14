-- Bulk upload drafts: a file analysed by the AI and waiting for the admin to review and publish.
-- Abandoned drafts (and their files) are deleted by the hourly job after 24 hours.
CREATE TABLE IF NOT EXISTS upload_drafts (
  key text PRIMARY KEY,
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes integer NOT NULL,
  metadata jsonb NOT NULL,
  thumb jsonb,
  moderation jsonb NOT NULL,
  analysis jsonb NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS upload_drafts_created_at_idx ON upload_drafts (created_at);
