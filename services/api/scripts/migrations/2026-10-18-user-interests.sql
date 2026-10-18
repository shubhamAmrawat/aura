-- Categories a user picked after sign-up (up to 4, enforced by the API), in the order they were picked.
-- Used later to shape their home feed. Additive only.
CREATE TABLE IF NOT EXISTS user_interests (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  position integer NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, category_id)
);
CREATE INDEX IF NOT EXISTS user_interests_category_idx ON user_interests (category_id);
