ALTER TABLE external_world_cup_2026.official_results
  ADD COLUMN IF NOT EXISTS semi_1_home_team TEXT,
  ADD COLUMN IF NOT EXISTS semi_1_away_team TEXT,
  ADD COLUMN IF NOT EXISTS semi_1_home_score INTEGER,
  ADD COLUMN IF NOT EXISTS semi_1_away_score INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_home_team TEXT,
  ADD COLUMN IF NOT EXISTS semi_2_away_team TEXT,
  ADD COLUMN IF NOT EXISTS semi_2_home_score INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_away_score INTEGER,
  ADD COLUMN IF NOT EXISTS final_home_team TEXT,
  ADD COLUMN IF NOT EXISTS final_away_team TEXT,
  ADD COLUMN IF NOT EXISTS final_home_score INTEGER,
  ADD COLUMN IF NOT EXISTS final_away_score INTEGER;

UPDATE external_world_cup_2026.official_results
SET semi_1_home_team = COALESCE(semi_1_home_team, 'Francia'),
    semi_1_away_team = COALESCE(semi_1_away_team, 'España'),
    semi_2_home_team = COALESCE(semi_2_home_team, 'Inglaterra'),
    semi_2_away_team = COALESCE(semi_2_away_team, 'Argentina')
WHERE id = 1;

ALTER TABLE external_world_cup_2026.prediction_entries
  ADD COLUMN IF NOT EXISTS semi_1_home_score INTEGER,
  ADD COLUMN IF NOT EXISTS semi_1_away_score INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_home_score INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_away_score INTEGER,
  ADD COLUMN IF NOT EXISTS final_home_team TEXT,
  ADD COLUMN IF NOT EXISTS final_away_team TEXT,
  ADD COLUMN IF NOT EXISTS final_home_score INTEGER,
  ADD COLUMN IF NOT EXISTS final_away_score INTEGER;

ALTER TABLE external_world_cup_2026.official_results
  DROP CONSTRAINT IF EXISTS official_results_semi_1_home_score_check,
  DROP CONSTRAINT IF EXISTS official_results_semi_1_away_score_check,
  DROP CONSTRAINT IF EXISTS official_results_semi_2_home_score_check,
  DROP CONSTRAINT IF EXISTS official_results_semi_2_away_score_check,
  DROP CONSTRAINT IF EXISTS official_results_final_home_score_check,
  DROP CONSTRAINT IF EXISTS official_results_final_away_score_check;

ALTER TABLE external_world_cup_2026.prediction_entries
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_1_home_score_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_1_away_score_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_2_home_score_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_2_away_score_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_final_home_score_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_final_away_score_check;

ALTER TABLE external_world_cup_2026.official_results
  ADD CONSTRAINT official_results_semi_1_home_score_check CHECK (semi_1_home_score IS NULL OR semi_1_home_score BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_semi_1_away_score_check CHECK (semi_1_away_score IS NULL OR semi_1_away_score BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_semi_2_home_score_check CHECK (semi_2_home_score IS NULL OR semi_2_home_score BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_semi_2_away_score_check CHECK (semi_2_away_score IS NULL OR semi_2_away_score BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_final_home_score_check CHECK (final_home_score IS NULL OR final_home_score BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_final_away_score_check CHECK (final_away_score IS NULL OR final_away_score BETWEEN 0 AND 20);

ALTER TABLE external_world_cup_2026.prediction_entries
  ADD CONSTRAINT prediction_entries_semi_1_home_score_check CHECK (semi_1_home_score IS NULL OR semi_1_home_score BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_semi_1_away_score_check CHECK (semi_1_away_score IS NULL OR semi_1_away_score BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_semi_2_home_score_check CHECK (semi_2_home_score IS NULL OR semi_2_home_score BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_semi_2_away_score_check CHECK (semi_2_away_score IS NULL OR semi_2_away_score BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_final_home_score_check CHECK (final_home_score IS NULL OR final_home_score BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_final_away_score_check CHECK (final_away_score IS NULL OR final_away_score BETWEEN 0 AND 20);
