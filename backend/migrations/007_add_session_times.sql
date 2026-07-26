-- The schedule originally stored only the three sessions the app needed: FP1
-- (the prediction lock), qualifying and the race. The race Info tab now shows
-- the whole weekend, so the remaining sessions are stored too.
--
-- All nullable: no weekend has all of them. A sprint weekend replaces FP2 and
-- FP3 with sprint qualifying and the sprint, so roughly half these columns are
-- NULL for any given race.
ALTER TABLE races ADD COLUMN IF NOT EXISTS fp2_time TIMESTAMPTZ;
ALTER TABLE races ADD COLUMN IF NOT EXISTS fp3_time TIMESTAMPTZ;
ALTER TABLE races ADD COLUMN IF NOT EXISTS sprint_qualifying_time TIMESTAMPTZ;
ALTER TABLE races ADD COLUMN IF NOT EXISTS sprint_time TIMESTAMPTZ;
