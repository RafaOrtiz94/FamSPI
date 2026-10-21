CREATE SCHEMA IF NOT EXISTS external_world_cup_2026;

CREATE TABLE IF NOT EXISTS external_world_cup_2026.portal_config (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  slug TEXT NOT NULL UNIQUE DEFAULT 'mundial-2026',
  title TEXT NOT NULL DEFAULT 'Predicciones Mundial 2026',
  subtitle TEXT NOT NULL DEFAULT 'Pronostica el torneo y participa con Famproject Cia. Ltda.',
  participation_open BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ NULL,
  ends_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT portal_config_singleton CHECK (id = 1)
);

INSERT INTO external_world_cup_2026.portal_config (
  id,
  slug,
  title,
  subtitle,
  participation_open
)
VALUES (
  1,
  'mundial-2026',
  'Predicciones Mundial 2026',
  'Pronostica el torneo y participa con Famproject Cia. Ltda.',
  TRUE
)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS external_world_cup_2026.official_results (
  id SMALLINT PRIMARY KEY DEFAULT 1,
  champion_team TEXT NULL,
  runner_up_team TEXT NULL,
  third_place_team TEXT NULL,
  fourth_place_team TEXT NULL,
  top_scorer_name TEXT NULL,
  best_player_name TEXT NULL,
  total_goals INTEGER NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT official_results_singleton CHECK (id = 1),
  CONSTRAINT official_results_total_goals_check CHECK (total_goals IS NULL OR total_goals BETWEEN 0 AND 500)
);

INSERT INTO external_world_cup_2026.official_results (id)
VALUES (1)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS external_world_cup_2026.prediction_entries (
  id BIGSERIAL PRIMARY KEY,
  participant_token UUID NOT NULL UNIQUE,
  participant_name TEXT NOT NULL,
  identity_document TEXT NOT NULL,
  identity_document_normalized TEXT NOT NULL,
  email TEXT NOT NULL,
  email_normalized TEXT NOT NULL,
  phone TEXT NULL,
  company_name TEXT NOT NULL,
  city TEXT NULL,
  country TEXT NULL,
  champion_team TEXT NOT NULL,
  runner_up_team TEXT NOT NULL,
  third_place_team TEXT NOT NULL,
  fourth_place_team TEXT NOT NULL,
  top_scorer_name TEXT NOT NULL,
  best_player_name TEXT NULL,
  total_goals_tiebreaker INTEGER NOT NULL,
  favorite_team TEXT NULL,
  notes TEXT NULL,
  consent_accepted BOOLEAN NOT NULL DEFAULT FALSE,
  source_path TEXT NULL,
  ip_address TEXT NULL,
  user_agent TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT prediction_entries_total_goals_check CHECK (total_goals_tiebreaker BETWEEN 0 AND 500),
  CONSTRAINT prediction_entries_unique_email UNIQUE (email_normalized),
  CONSTRAINT prediction_entries_unique_identity UNIQUE (identity_document_normalized)
);

CREATE INDEX IF NOT EXISTS idx_wc2026_prediction_entries_created_at
  ON external_world_cup_2026.prediction_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wc2026_prediction_entries_company
  ON external_world_cup_2026.prediction_entries (company_name);
