CREATE TABLE IF NOT EXISTS races (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_race_id TEXT UNIQUE NOT NULL,
    grand_prix TEXT NOT NULL,
    circuit_name TEXT NOT NULL,
    country TEXT NOT NULL,
    fp1_time TIMESTAMPTZ NOT NULL,
    qualifying_time TIMESTAMPTZ,
    race_time TIMESTAMPTZ NOT NULL,
    season INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'upcoming'
);
