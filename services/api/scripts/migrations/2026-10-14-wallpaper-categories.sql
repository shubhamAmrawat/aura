-- Extra categories per wallpaper (the primary one stays in wallpapers.category_id).
-- A wallpaper is listed on its primary category page and on each extra one (max 2 extras, enforced by the API).
CREATE TABLE IF NOT EXISTS wallpaper_categories (
  wallpaper_id uuid NOT NULL REFERENCES wallpapers(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (wallpaper_id, category_id)
);
CREATE INDEX IF NOT EXISTS wallpaper_categories_category_idx ON wallpaper_categories (category_id);
