-- Image fingerprint (64-bit perceptual hash) for duplicate detection: re-uploads of a wallpaper that is
-- already on Aurora (resized, re-compressed or lightly edited) are blocked or sent to review.
-- Filled for new uploads; existing wallpapers are filled by the hourly job / scripts/backfill-phash.mts. Additive only.
ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS phash bigint;
