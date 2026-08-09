-- Persisted copy of the official F1 Drivers' Championship, so the standings
-- survive a cold start and stay servable when the upstream API is unavailable.
CREATE TABLE IF NOT EXISTS driver_standings (
    season         INT NOT NULL,
    driver_id      TEXT NOT NULL,
    position       INT NOT NULL DEFAULT 0,
    points         INT NOT NULL DEFAULT 0,
    wins           INT NOT NULL DEFAULT 0,
    broadcast_name TEXT NOT NULL DEFAULT '',
    team_name      TEXT NOT NULL DEFAULT '',
    team_color     TEXT NOT NULL DEFAULT '',
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (season, driver_id)
);
