-- 092_client_assignments_temporal_reassignment.sql
-- Objetivo:
-- 1) Permitir asignaciones temporales de clientes entre asesores.
-- 2) Garantizar asignación automática del cliente aprobado al comercial creador.

CREATE TABLE IF NOT EXISTS client_assignments (
  id SERIAL PRIMARY KEY,
  client_request_id INTEGER NOT NULL REFERENCES client_requests(id) ON DELETE CASCADE,
  assigned_to_email TEXT NOT NULL,
  assigned_by_email TEXT,
  assignment_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  is_temporary BOOLEAN NOT NULL DEFAULT FALSE,
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_request_id, assigned_to_email),
  CONSTRAINT client_assignments_assignment_type_check
    CHECK (assignment_type IN ('owner', 'manual', 'temporary')),
  CONSTRAINT client_assignments_temporary_dates_check
    CHECK (
      is_temporary = FALSE
      OR (
        ends_at IS NOT NULL
        AND (starts_at IS NULL OR ends_at > starts_at)
      )
    )
);

ALTER TABLE client_assignments
  ADD COLUMN IF NOT EXISTS assignment_type VARCHAR(20) NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS is_temporary BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS starts_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS reason TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_assignments_assignment_type_check'
  ) THEN
    ALTER TABLE client_assignments
      ADD CONSTRAINT client_assignments_assignment_type_check
      CHECK (assignment_type IN ('owner', 'manual', 'temporary'));
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_assignments_temporary_dates_check'
  ) THEN
    ALTER TABLE client_assignments
      ADD CONSTRAINT client_assignments_temporary_dates_check
      CHECK (
        is_temporary = FALSE
        OR (
          ends_at IS NOT NULL
          AND (starts_at IS NULL OR ends_at > starts_at)
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_client_assignments_client_active
  ON client_assignments (client_request_id, is_active, starts_at, ends_at);

CREATE INDEX IF NOT EXISTS idx_client_assignments_assigned_email
  ON client_assignments (assigned_to_email);

INSERT INTO client_assignments (
  client_request_id,
  assigned_to_email,
  assigned_by_email,
  assignment_type,
  is_temporary,
  starts_at,
  is_active,
  reason
)
SELECT
  cr.id,
  LOWER(cr.created_by),
  LOWER(cr.created_by),
  'owner',
  FALSE,
  COALESCE(cr.approved_at, cr.created_at, NOW()),
  TRUE,
  'Asignacion automatica por registro del cliente'
FROM client_requests cr
WHERE cr.status = 'approved'
  AND cr.created_by IS NOT NULL
  AND TRIM(cr.created_by) <> ''
ON CONFLICT (client_request_id, assigned_to_email) DO NOTHING;
