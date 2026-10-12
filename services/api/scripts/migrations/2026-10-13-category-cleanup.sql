-- Category cleanup support. Additive only.
BEGIN;

-- Old category slugs → the category they now belong to (renames + merges), so old links redirect.
CREATE TABLE IF NOT EXISTS category_redirects (
  old_slug text PRIMARY KEY,
  category_id uuid NOT NULL CONSTRAINT category_redirects_category_id_categories_id_fk REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now()
);

-- AI category suggestions (one row per wallpaper), reviewed in the admin dashboard.
CREATE TABLE IF NOT EXISTS category_suggestions (
  wallpaper_id uuid PRIMARY KEY CONSTRAINT category_suggestions_wallpaper_id_wallpapers_id_fk REFERENCES wallpapers(id) ON DELETE CASCADE,
  current_category_id uuid CONSTRAINT category_suggestions_current_category_id_categories_id_fk REFERENCES categories(id) ON DELETE SET NULL,
  suggested_category_id uuid CONSTRAINT category_suggestions_suggested_category_id_categories_id_fk REFERENCES categories(id) ON DELETE SET NULL,
  alternative_category_id uuid CONSTRAINT category_suggestions_alternative_category_id_categories_id_fk REFERENCES categories(id) ON DELETE SET NULL,
  confidence real NOT NULL,
  current_fits boolean,
  new_category_idea text,
  reason text,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CONSTRAINT category_suggestions_status_check CHECK (status IN ('pending', 'applied', 'auto_applied', 'dismissed')),
  created_at timestamp NOT NULL DEFAULT now(),
  resolved_at timestamp,
  resolved_by uuid CONSTRAINT category_suggestions_resolved_by_users_id_fk REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS category_suggestions_status_idx ON category_suggestions (status);

COMMIT;
