-- ============================================================
-- Migration 222: Módulo de Capacitaciones
-- Tablas: trainings, training_attendees
-- ============================================================

CREATE TABLE IF NOT EXISTS trainings (
  id   BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL, -- CAP-2026-001

  -- Clasificación
  title       TEXT NOT NULL,
  description TEXT,
  type        TEXT NOT NULL CHECK (type IN ('interna', 'externa_instructor', 'externa_desplazamiento')),
  event_type  TEXT NOT NULL DEFAULT 'capacitacion'
              CHECK (event_type IN ('capacitacion', 'induccion', 'charla', 'reunion')),

  -- Estado del ciclo de vida
  status TEXT NOT NULL DEFAULT 'draft'
         CHECK (status IN ('draft', 'scheduled', 'in_progress', 'completed', 'cancelled')),

  -- Logística
  modality            TEXT DEFAULT 'presencial' CHECK (modality IN ('presencial', 'virtual', 'hibrida')),
  scheduled_date      DATE,
  scheduled_time_start TIME,
  scheduled_time_end   TIME,
  duration_hours      NUMERIC(5, 2),
  location            TEXT,
  area                TEXT,
  category            TEXT,

  -- Contenido del acta
  objectives  TEXT,
  methodology TEXT,
  topics      TEXT[],
  material    TEXT,
  observations TEXT,
  conclusions  TEXT,

  -- Instructor
  trainer_name    TEXT,
  trainer_type    TEXT CHECK (trainer_type IN ('interno', 'externo')),
  trainer_user_id INTEGER REFERENCES users (id),

  -- Acta generada (Google Docs → PDF)
  acta_drive_doc_id TEXT,
  acta_drive_pdf_id TEXT,
  acta_drive_url    TEXT,
  acta_folder_id    TEXT,
  acta_generated_at TIMESTAMPTZ,

  -- Solo externa_instructor: PDF subido firmado por el externo
  external_signed_drive_id   TEXT,
  external_signed_drive_url  TEXT,
  external_signed_at         TIMESTAMPTZ,
  external_signed_by_name    TEXT,

  -- FamSign — workflow principal (asistentes que fueron)
  requires_famsign          BOOLEAN NOT NULL DEFAULT false,
  signature_workflow_id     BIGINT REFERENCES signature_workflows (id),
  signature_workflow_status TEXT,
  final_verification_token  TEXT,
  final_pdf_generated_at    TIMESTAMPTZ,

  -- FamSign — workflow inasistentes (2do workflow independiente)
  absent_acta_drive_pdf_id      TEXT,
  absent_acta_generated_at      TIMESTAMPTZ,
  absent_workflow_id            BIGINT REFERENCES signature_workflows (id),
  absent_workflow_status        TEXT,
  absent_verification_token     TEXT,
  absent_final_pdf_generated_at TIMESTAMPTZ,

  -- Auditoría
  created_by INTEGER REFERENCES users (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active     BOOLEAN NOT NULL DEFAULT true
);

-- -------------------------------------------------------

CREATE TABLE IF NOT EXISTS training_attendees (
  id          BIGSERIAL PRIMARY KEY,
  training_id BIGINT  NOT NULL REFERENCES trainings (id) ON DELETE CASCADE,
  user_id     INTEGER NOT NULL REFERENCES users (id),

  -- Snapshot en el momento de la asignación (fuente: collaborator_profiles)
  name_snapshot   TEXT,
  cedula_snapshot TEXT,
  cargo_snapshot  TEXT,
  email_snapshot  TEXT,

  -- Asistencia real (marcada post-evento)
  attendance_status    TEXT NOT NULL DEFAULT 'assigned'
                       CHECK (attendance_status IN ('assigned', 'attended', 'absent', 'cancelled')),
  attendance_marked_at TIMESTAMPTZ,

  -- FamSign workflow PRINCIPAL
  signer_id        BIGINT,
  signature_status TEXT,
  signed_at        TIMESTAMPTZ,

  -- FamSign workflow INASISTENTES
  absent_signer_id        BIGINT,
  absent_signature_status TEXT,
  absent_signed_at        TIMESTAMPTZ,

  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (training_id, user_id)
);

-- -------------------------------------------------------
-- Índices
-- -------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_trainings_status
  ON trainings (status) WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_trainings_created_by
  ON trainings (created_by);

CREATE INDEX IF NOT EXISTS idx_trainings_scheduled_date
  ON trainings (scheduled_date);

CREATE INDEX IF NOT EXISTS idx_trainings_type
  ON trainings (type);

CREATE INDEX IF NOT EXISTS idx_training_attendees_training
  ON training_attendees (training_id);

CREATE INDEX IF NOT EXISTS idx_training_attendees_user
  ON training_attendees (user_id);

CREATE INDEX IF NOT EXISTS idx_training_attendees_attendance
  ON training_attendees (training_id, attendance_status);
