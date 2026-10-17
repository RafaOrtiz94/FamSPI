--
-- Migration 153: BC — Add CANCELADO and RECHAZADO_POR_GERENCIA terminal states
--
-- canonical_state is VARCHAR(50) with no CHECK constraint, so no schema change needed.
-- This migration adds the bc_cancelled_at / bc_rejected_at audit columns and updates
-- the canonical_state comment to reflect the full state list.
--

-- Audit timestamp columns for terminal negative states
ALTER TABLE equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS bc_cancelled_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bc_cancelled_by   INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS bc_cancelled_reason TEXT,
  ADD COLUMN IF NOT EXISTS bc_rejected_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bc_rejected_by    INTEGER REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS bc_rejected_reason TEXT;

-- Index for filtering cancelled/rejected BCs in dashboards
CREATE INDEX IF NOT EXISTS idx_epr_cancelled_state
  ON equipment_purchase_requests (canonical_state)
  WHERE canonical_state IN ('CANCELADO', 'RECHAZADO_POR_GERENCIA');

-- Update column comment with full state list
COMMENT ON COLUMN equipment_purchase_requests.canonical_state IS
  'BC workflow state. Valid values: DRAFT_INICIAL, DATOS_BASE_COMPLETOS, '
  'EN_EVALUACION_VIABILIDAD, OBSERVADO_POR_VIABILIDAD, VIABLE, '
  'AJUSTES_OPERATIVOS, CERRADO_PARA_APROBACION (terminal-positive), '
  'RECHAZADO_POR_GERENCIA (terminal-negative), CANCELADO (terminal-negative)';

-- Rollback hint (manual):
-- ALTER TABLE equipment_purchase_requests
--   DROP COLUMN IF EXISTS bc_cancelled_at,
--   DROP COLUMN IF EXISTS bc_cancelled_by,
--   DROP COLUMN IF EXISTS bc_cancelled_reason,
--   DROP COLUMN IF EXISTS bc_rejected_at,
--   DROP COLUMN IF EXISTS bc_rejected_by,
--   DROP COLUMN IF EXISTS bc_rejected_reason;
-- DROP INDEX IF EXISTS idx_epr_cancelled_state;
