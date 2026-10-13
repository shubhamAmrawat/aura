-- Admin can hide a category (and all its wallpapers) from the public site.
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_hidden boolean NOT NULL DEFAULT false;
