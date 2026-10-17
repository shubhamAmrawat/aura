-- "Last active" in Admin › Users: when a signed-in user last used the website or app.
-- Updated by the API on authenticated requests (at most every 5 minutes per user). Additive only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_active_at timestamp;

-- Start from the latest known activity (download, like or upload) so the column isn't empty.
UPDATE users u SET last_active_at = GREATEST(
  (SELECT max(d.created_at) FROM downloads d WHERE d.user_id = u.id),
  (SELECT max(l.created_at) FROM likes l WHERE l.user_id = u.id),
  (SELECT max(w.created_at) FROM wallpapers w WHERE w.uploader_id = u.id))
WHERE u.last_active_at IS NULL;
