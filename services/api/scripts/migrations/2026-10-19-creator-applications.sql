-- Creator applications: people send 3–6 of their best wallpapers; an AI pre-screen scores them and
-- an admin approves (→ users.is_creator) or rejects with a note. Existing creators are untouched. Additive only.
CREATE TABLE IF NOT EXISTS creator_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  about text,
  portfolio_url text,
  ai_status text NOT NULL DEFAULT 'pending' CHECK (ai_status IN ('pending', 'done', 'failed')),
  ai_score integer,
  ai_verdict text,
  ai_summary text,
  review_note text,
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_applications_status_created_idx ON creator_applications (status, created_at);
CREATE INDEX IF NOT EXISTS creator_applications_user_idx ON creator_applications (user_id, created_at);
-- At most one application waiting for review per user.
CREATE UNIQUE INDEX IF NOT EXISTS creator_applications_one_pending_idx ON creator_applications (user_id) WHERE status = 'pending';

-- Sample wallpapers. application_id is null while the person is still filling in the form.
CREATE TABLE IF NOT EXISTS creator_application_samples (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  application_id uuid REFERENCES creator_applications(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  thumb_url text,
  width integer NOT NULL,
  height integer NOT NULL,
  bytes integer NOT NULL,
  position integer NOT NULL DEFAULT 0,
  ai_score integer,
  ai_note text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS creator_application_samples_app_idx ON creator_application_samples (application_id);
CREATE INDEX IF NOT EXISTS creator_application_samples_user_idx ON creator_application_samples (user_id);
