-- Wallpaper of the day (app home): one random wallpaper per day per screen shape. A wallpaper is
-- picked at most once per cycle (unique below); when every eligible wallpaper has had its day, a
-- new cycle starts. The row goes away if its wallpaper is deleted, and that day gets a new pick.
-- Additive only.
CREATE TABLE IF NOT EXISTS daily_wallpapers (
  day date NOT NULL,
  screen text NOT NULL CHECK (screen IN ('mobile', 'tablet')),
  wallpaper_id uuid NOT NULL REFERENCES wallpapers(id) ON DELETE CASCADE,
  cycle integer NOT NULL DEFAULT 1,
  created_at timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (day, screen),
  UNIQUE (screen, cycle, wallpaper_id)
);
