-- Migración 221: Propuestas salariales del proceso de contratación
-- Cada postulante puede recibir varias propuestas antes de aceptar

BEGIN;

CREATE TABLE IF NOT EXISTS hiring_salary_proposals (
  id                  SERIAL PRIMARY KEY,
  entry_id            INTEGER NOT NULL REFERENCES applicant_pipeline_entries(id) ON DELETE CASCADE,
  proposal_number     INTEGER NOT NULL DEFAULT 1,
  base_salary         NUMERIC(10,2) NOT NULL,
  currency            VARCHAR(10) DEFAULT 'USD',
  benefits            TEXT,
  extra_notes         TEXT,
  sent_at             TIMESTAMPTZ,
  applicant_response  VARCHAR(20) DEFAULT 'pendiente',
  -- pendiente | aceptada | rechazada
  response_notes      TEXT,
  created_by          INTEGER REFERENCES users(id),
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_salary_proposals_entry ON hiring_salary_proposals(entry_id);

COMMIT;
