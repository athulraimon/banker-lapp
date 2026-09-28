-- Pole is now picked up automatically once qualifying finishes, ahead of the
-- full race result. It lives on races rather than race_results because
-- race_results is only ever written all-at-once (pole+P1+P2+P3 together) when
-- the podium is known and scoring can run.
ALTER TABLE races ADD COLUMN IF NOT EXISTS pole_driver_id TEXT;
