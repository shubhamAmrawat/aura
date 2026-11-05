-- Where people use Aurora: where they signed up (app / website) and when they were first and
-- last seen on each. Existing users: sign-up place unknown; app / website use filled in from
-- their phones, browsers and downloads. Additive only.
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_source text;   -- 'app' | 'web' | null (before tracking)
ALTER TABLE users ADD COLUMN IF NOT EXISTS signup_method text;   -- 'google' | 'email' | null
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_app_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_app_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS first_web_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_web_at timestamp;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_web_agent text;  -- the browser's user agent, for "Chrome on Windows"

UPDATE users u SET
  first_app_at = LEAST(
    (SELECT min(p.created_at) FROM push_devices p WHERE p.user_id = u.id),
    (SELECT min(d.created_at) FROM downloads d WHERE d.user_id = u.id AND d.source = 'mobile')),
  last_app_at = GREATEST(
    (SELECT max(p.last_seen_at) FROM push_devices p WHERE p.user_id = u.id),
    (SELECT max(d.created_at) FROM downloads d WHERE d.user_id = u.id AND d.source = 'mobile'))
WHERE u.first_app_at IS NULL;

UPDATE users u SET
  first_web_at = LEAST(
    (SELECT min(w.created_at) FROM web_push_subscriptions w WHERE w.user_id = u.id),
    (SELECT min(d.created_at) FROM downloads d WHERE d.user_id = u.id AND d.source = 'web')),
  last_web_at = GREATEST(
    (SELECT max(w.last_seen_at) FROM web_push_subscriptions w WHERE w.user_id = u.id),
    (SELECT max(d.created_at) FROM downloads d WHERE d.user_id = u.id AND d.source = 'web')),
  last_web_agent = (SELECT w.user_agent FROM web_push_subscriptions w WHERE w.user_id = u.id ORDER BY w.last_seen_at DESC LIMIT 1)
WHERE u.first_web_at IS NULL;
