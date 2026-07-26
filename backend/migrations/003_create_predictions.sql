CREATE TABLE IF NOT EXISTS predictions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    race_id UUID NOT NULL REFERENCES races(id),
    pole_driver_id TEXT,
    p1_driver_id TEXT,
    p2_driver_id TEXT,
    p3_driver_id TEXT,
    locked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, race_id)
);
