-- Migration: 186_module_global_status.sql
-- Adds a global stage tracker for every module so TI can manage
-- which modules are in production, testing (whitelist), or construction.

CREATE TABLE IF NOT EXISTS module_global_status (
  module_key        TEXT PRIMARY KEY,
  stage             TEXT NOT NULL DEFAULT 'production'
                    CHECK (stage IN ('production', 'testing', 'construction')),
  whitelist_emails  TEXT[] NOT NULL DEFAULT '{}',
  updated_by        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed: kickoff_2026 starts in testing with known E2E testers
INSERT INTO module_global_status (module_key, stage, whitelist_emails)
VALUES (
  'kickoff_2026',
  'testing',
  ARRAY[
    'alex.farino@fam-project.com',
    'pamela.altamirano@fam-project.com',
    'rafael.ortiz@fam-project.com',
    'erick.gavilanes@fam-project.com'
  ]
)
ON CONFLICT (module_key) DO NOTHING;
