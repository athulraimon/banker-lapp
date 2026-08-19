-- Players can now rename themselves, and UpsertUser writes Google's profile name
-- on every single login. Without a flag to say "this one was chosen by hand", the
-- next sign-in would silently revert the new name and the feature would look
-- broken rather than merely conflicted.
--
-- Defaults to FALSE so existing rows keep tracking their Google name until their
-- owner edits it.
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name_custom BOOLEAN NOT NULL DEFAULT FALSE;
