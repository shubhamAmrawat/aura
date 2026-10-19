-- AI-written drafts of the approval and rejection notes for each creator application.
-- The admin reviews/edits one and it's sent in the decision email. Additive only.
ALTER TABLE creator_applications ADD COLUMN IF NOT EXISTS ai_approve_message text;
ALTER TABLE creator_applications ADD COLUMN IF NOT EXISTS ai_reject_message text;
