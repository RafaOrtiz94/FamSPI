BEGIN;

ALTER TABLE permisos_estudios_matriculas
  ADD COLUMN IF NOT EXISTS approver_role TEXT,
  ADD COLUMN IF NOT EXISTS approver_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS approver_email TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS reviewed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS review_reason TEXT;

ALTER TABLE permisos_estudios_matriculas
  DROP CONSTRAINT IF EXISTS permisos_estudios_matriculas_status_check;

ALTER TABLE permisos_estudios_matriculas
  ADD CONSTRAINT permisos_estudios_matriculas_status_check
  CHECK (status IN ('pending_validation', 'active', 'rejected', 'expired', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_permisos_matriculas_approver_status
  ON permisos_estudios_matriculas (approver_user_id, approver_role, status, created_at DESC);

COMMIT;
