-- Drops: editorial collections made by an admin (e.g. "Diwali Drops"), shown as a banner on the
-- app and website home pages between starts_at and ends_at. They reuse collections +
-- collection_wallpapers (sort_order = the order the admin set). kind = 'user' for everything
-- that already exists. published_at null = draft. Times are UTC. Additive only.
ALTER TABLE collections
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'user',
  ADD COLUMN IF NOT EXISTS starts_at timestamp,
  ADD COLUMN IF NOT EXISTS ends_at timestamp,
  ADD COLUMN IF NOT EXISTS published_at timestamp,
  ADD COLUMN IF NOT EXISTS show_on_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS show_on_web boolean NOT NULL DEFAULT true;

DO $$ BEGIN
  ALTER TABLE collections ADD CONSTRAINT collections_kind_check CHECK (kind IN ('user', 'drop'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS collections_drops_idx ON collections (starts_at) WHERE kind = 'drop';
