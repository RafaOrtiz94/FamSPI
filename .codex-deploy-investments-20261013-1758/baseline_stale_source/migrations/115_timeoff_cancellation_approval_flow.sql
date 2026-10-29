BEGIN;

ALTER TABLE permisos_vacaciones
  ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by_email TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_review_reason TEXT;

ALTER TABLE permisos_vacaciones
  DROP CONSTRAINT IF EXISTS permisos_vacaciones_cancellation_status_check;

ALTER TABLE permisos_vacaciones
  ADD CONSTRAINT permisos_vacaciones_cancellation_status_check
  CHECK (cancellation_status IN ('none', 'pending', 'approved', 'rejected'));

ALTER TABLE vacaciones_solicitudes
  ADD COLUMN IF NOT EXISTS cancellation_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS cancellation_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancellation_requested_by_email TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_request_reason TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS cancellation_reviewed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_review_reason TEXT;

ALTER TABLE vacaciones_solicitudes
  DROP CONSTRAINT IF EXISTS vacaciones_solicitudes_cancellation_status_check;

ALTER TABLE vacaciones_solicitudes
  ADD CONSTRAINT vacaciones_solicitudes_cancellation_status_check
  CHECK (cancellation_status IN ('none', 'pending', 'approved', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_permisos_vacaciones_cancellation_status
  ON permisos_vacaciones (cancellation_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_vacaciones_solicitudes_cancellation_status
  ON vacaciones_solicitudes (cancellation_status, updated_at DESC);

COMMIT;
