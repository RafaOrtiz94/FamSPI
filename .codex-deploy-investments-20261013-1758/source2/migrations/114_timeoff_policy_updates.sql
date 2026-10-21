BEGIN;

-- Permisos/Vacaciones (tabla unificada) - nuevos estados y trazabilidad de cancelacion
ALTER TABLE permisos_vacaciones
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancelled_by_email TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS study_enrollment_id BIGINT;

ALTER TABLE permisos_vacaciones
  DROP CONSTRAINT IF EXISTS permisos_vacaciones_status_check;

ALTER TABLE permisos_vacaciones
  ADD CONSTRAINT permisos_vacaciones_status_check
  CHECK (status IN ('pending','partially_approved','pending_final','approved','rejected','cancelled'));

-- Vacaciones (modulo dedicado) - soporte horario y cancelacion
ALTER TABLE vacaciones_solicitudes
  ADD COLUMN IF NOT EXISTS start_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS duration_hours NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancelled_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancelled_by_email TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;

-- Matriculas de estudio por colaborador (vigencia para permisos por educacion)
CREATE TABLE IF NOT EXISTS permisos_estudios_matriculas (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_email TEXT NOT NULL,
  institution_name TEXT NOT NULL,
  program_name TEXT,
  valid_from DATE NOT NULL,
  valid_until DATE NOT NULL,
  drive_file_id TEXT,
  drive_file_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  created_by_user_id INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (valid_until >= valid_from)
);

CREATE INDEX IF NOT EXISTS idx_permisos_matriculas_user_status
  ON permisos_estudios_matriculas (user_id, status, valid_until DESC);

CREATE UNIQUE INDEX IF NOT EXISTS ux_permisos_matriculas_active_user
  ON permisos_estudios_matriculas (user_id)
  WHERE status = 'active';

COMMIT;
