ALTER TABLE external_world_cup_2026.official_results
  ADD COLUMN IF NOT EXISTS semi_1_home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS semi_1_away_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_away_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS final_home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS final_away_penalties INTEGER;

ALTER TABLE external_world_cup_2026.prediction_entries
  ADD COLUMN IF NOT EXISTS semi_1_home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS semi_1_away_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS semi_2_away_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS final_home_penalties INTEGER,
  ADD COLUMN IF NOT EXISTS final_away_penalties INTEGER;

ALTER TABLE external_world_cup_2026.official_results
  DROP CONSTRAINT IF EXISTS official_results_semi_1_home_penalties_check,
  DROP CONSTRAINT IF EXISTS official_results_semi_1_away_penalties_check,
  DROP CONSTRAINT IF EXISTS official_results_semi_2_home_penalties_check,
  DROP CONSTRAINT IF EXISTS official_results_semi_2_away_penalties_check,
  DROP CONSTRAINT IF EXISTS official_results_final_home_penalties_check,
  DROP CONSTRAINT IF EXISTS official_results_final_away_penalties_check;

ALTER TABLE external_world_cup_2026.prediction_entries
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_1_home_penalties_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_1_away_penalties_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_2_home_penalties_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_semi_2_away_penalties_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_final_home_penalties_check,
  DROP CONSTRAINT IF EXISTS prediction_entries_final_away_penalties_check;

ALTER TABLE external_world_cup_2026.official_results
  ADD CONSTRAINT official_results_semi_1_home_penalties_check CHECK (semi_1_home_penalties IS NULL OR semi_1_home_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_semi_1_away_penalties_check CHECK (semi_1_away_penalties IS NULL OR semi_1_away_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_semi_2_home_penalties_check CHECK (semi_2_home_penalties IS NULL OR semi_2_home_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_semi_2_away_penalties_check CHECK (semi_2_away_penalties IS NULL OR semi_2_away_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_final_home_penalties_check CHECK (final_home_penalties IS NULL OR final_home_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT official_results_final_away_penalties_check CHECK (final_away_penalties IS NULL OR final_away_penalties BETWEEN 0 AND 20);

ALTER TABLE external_world_cup_2026.prediction_entries
  ADD CONSTRAINT prediction_entries_semi_1_home_penalties_check CHECK (semi_1_home_penalties IS NULL OR semi_1_home_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_semi_1_away_penalties_check CHECK (semi_1_away_penalties IS NULL OR semi_1_away_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_semi_2_home_penalties_check CHECK (semi_2_home_penalties IS NULL OR semi_2_home_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_semi_2_away_penalties_check CHECK (semi_2_away_penalties IS NULL OR semi_2_away_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_final_home_penalties_check CHECK (final_home_penalties IS NULL OR final_home_penalties BETWEEN 0 AND 20),
  ADD CONSTRAINT prediction_entries_final_away_penalties_check CHECK (final_away_penalties IS NULL OR final_away_penalties BETWEEN 0 AND 20);
