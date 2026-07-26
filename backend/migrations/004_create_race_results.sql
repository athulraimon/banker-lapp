CREATE TABLE IF NOT EXISTS race_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    race_id UUID UNIQUE NOT NULL REFERENCES races(id),
    pole_driver_id TEXT NOT NULL,
    p1_driver_id TEXT NOT NULL,
    p2_driver_id TEXT NOT NULL,
    p3_driver_id TEXT NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW()
);
