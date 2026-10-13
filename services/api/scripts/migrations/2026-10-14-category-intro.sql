-- Longer intro text shown on each category page (editable in Admin → Categories).
ALTER TABLE categories ADD COLUMN IF NOT EXISTS intro text;
