-- Featured ordering + site settings. Additive only.
BEGIN;

ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS featured_order integer;
CREATE INDEX IF NOT EXISTS wallpapers_featured_order_idx ON wallpapers (featured_order) WHERE is_featured;

-- Keep today's home-page order (newest first) for wallpapers that are already featured
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at DESC, id) AS rn
  FROM wallpapers WHERE is_featured AND featured_order IS NULL
)
UPDATE wallpapers w SET featured_order = r.rn FROM ranked r WHERE w.id = r.id;

CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by uuid CONSTRAINT site_settings_updated_by_users_id_fk REFERENCES users(id) ON DELETE SET NULL
);
INSERT INTO site_settings (key, value) VALUES ('featured.limit', '5') ON CONFLICT (key) DO NOTHING;

COMMIT;
