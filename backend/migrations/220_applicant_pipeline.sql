-- Migración 220: Pipeline de selección y contratación de postulantes
-- Crea las tablas base del proceso de evaluación multi-etapa

BEGIN;

-- Una fila por cada postulante que entra al proceso de evaluación de una solicitud
CREATE TABLE IF NOT EXISTS applicant_pipeline_entries (
  id                SERIAL PRIMARY KEY,
  applicant_id      INTEGER NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
  request_id        INTEGER NOT NULL REFERENCES personnel_requests(id) ON DELETE CASCADE,
  -- Estado general del postulante en el pipeline
  status            VARCHAR(30) NOT NULL DEFAULT 'en_evaluacion',
  -- en_evaluacion | contratado | rechazado | retirado
  -- Etapa actual en la que se encuentra
  current_stage     VARCHAR(40) NOT NULL DEFAULT 'revision_perfil',
  -- revision_perfil | primera_entrevista | prueba_habilidades |
  -- evaluacion_psicologica | entrevista_gerencia | oferta_contratacion | completado
  started_by        INTEGER REFERENCES users(id),
  started_at        TIMESTAMPTZ DEFAULT NOW(),
  ended_at          TIMESTAMPTZ,
  rejection_stage   VARCHAR(40),
  rejection_reason  TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(applicant_id, request_id)
);

-- Una fila por cada etapa que completa (o intenta) un postulante
CREATE TABLE IF NOT EXISTS applicant_stage_results (
  id              SERIAL PRIMARY KEY,
  entry_id        INTEGER NOT NULL REFERENCES applicant_pipeline_entries(id) ON DELETE CASCADE,
  stage           VARCHAR(40) NOT NULL,
  -- Mismo vocabulario que current_stage
  status          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
  -- pendiente | en_progreso | completado
  -- Datos específicos de la etapa (fecha reunión, responsable prueba, etc.)
  data            JSONB NOT NULL DEFAULT '{}',
  observations    TEXT,
  score           NUMERIC(5,2),
  result          VARCHAR(20),
  -- aprobado | rechazado
  completed_by    INTEGER REFERENCES users(id),
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_pipeline_entries_request   ON applicant_pipeline_entries(request_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_entries_applicant ON applicant_pipeline_entries(applicant_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_entries_status    ON applicant_pipeline_entries(status);
CREATE INDEX IF NOT EXISTS idx_pipeline_stages_entry      ON applicant_stage_results(entry_id);

COMMIT;
