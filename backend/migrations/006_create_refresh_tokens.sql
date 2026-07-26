-- Refresh tokens used to live in Redis. Keeping them in Postgres removes a whole
-- service from the deployment: the app is now one Go container + one database,
-- which is what the free hosting tiers give you.
CREATE TABLE IF NOT EXISTS refresh_tokens (
    user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token      TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Lets the periodic sweep drop expired rows without a sequential scan.
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens (expires_at);
