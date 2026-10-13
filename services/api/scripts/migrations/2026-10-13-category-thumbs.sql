-- Small cover thumbnails for categories (navbar Explore menu).
-- Additive and nullable: safe while the current API runs.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_thumb_url text;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS cover_thumb_source text;
