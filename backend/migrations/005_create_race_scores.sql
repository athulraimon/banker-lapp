CREATE TABLE IF NOT EXISTS race_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    race_id UUID NOT NULL REFERENCES races(id),
    points INT NOT NULL DEFAULT 0,
    correct_winner BOOLEAN DEFAULT FALSE,
    calculated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, race_id)
);
