--
-- Migration 154: BC SLA — Add entered_state_at column
--
-- Tracks when the BC entered its current canonical_state.
-- Updated by the state machine on every transition.
--

ALTER TABLE equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS entered_state_at TIMESTAMPTZ DEFAULT NOW();

-- Backfill from existing transition log (latest transition = current state entry)
UPDATE equipment_purchase_requests epr
SET entered_state_at = sub.transitioned_at
FROM (
  SELECT DISTINCT ON (business_case_id)
    business_case_id,
    transitioned_at
  FROM business_case_state_transitions
  ORDER BY business_case_id, transitioned_at DESC
) sub
WHERE epr.id = sub.business_case_id
  AND epr.entered_state_at IS NULL;

-- For BCs with no transitions yet, use created_at
UPDATE equipment_purchase_requests
SET entered_state_at = created_at
WHERE entered_state_at IS NULL AND uses_modern_system = true;

-- Index for SLA queries
CREATE INDEX IF NOT EXISTS idx_epr_sla_state_entered
  ON equipment_purchase_requests (canonical_state, entered_state_at)
  WHERE canonical_state NOT IN ('CANCELADO', 'RECHAZADO_POR_GERENCIA');

COMMENT ON COLUMN equipment_purchase_requests.entered_state_at IS
  'Timestamp when the BC entered its current canonical_state. Used for SLA tracking.';
