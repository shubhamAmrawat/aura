-- Admin dashboard, Phase 2 (review queue). Additive only.
ALTER TABLE wallpapers ADD COLUMN IF NOT EXISTS review_note text;
