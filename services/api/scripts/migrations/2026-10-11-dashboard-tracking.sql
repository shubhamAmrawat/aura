-- Dashboard tracking. Additive only.
-- Views per wallpaper per day (IST) per client, and the client on each download.
BEGIN;

CREATE TABLE IF NOT EXISTS wallpaper_views_daily (
  wallpaper_id uuid NOT NULL CONSTRAINT wallpaper_views_daily_wallpaper_id_wallpapers_id_fk
    REFERENCES wallpapers(id) ON DELETE CASCADE,
  day date NOT NULL,
  source text NOT NULL DEFAULT 'unknown',
  views integer NOT NULL DEFAULT 0,
  CONSTRAINT wallpaper_views_daily_pk PRIMARY KEY (wallpaper_id, day, source)
);
CREATE INDEX IF NOT EXISTS wallpaper_views_daily_day_idx ON wallpaper_views_daily (day);

ALTER TABLE downloads ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'unknown';

COMMIT;
