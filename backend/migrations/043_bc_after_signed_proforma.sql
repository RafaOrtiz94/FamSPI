-- Migration: Move BC creation to after signed proforma + Add BC gating for contracts
-- Description: Add fields to track commercial certainty, BC creation timing, and BC approval status

-- Add new fields to equipment_purchase_requests table
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS proforma_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS commercial_certainty BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bc_created_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS bc_locked_until_signed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bc_status VARCHAR(20) DEFAULT 'not_created',
ADD COLUMN IF NOT EXISTS bc_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bc_submitted_by INTEGER,
ADD COLUMN IF NOT EXISTS bc_approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bc_approved_by INTEGER,
ADD COLUMN IF NOT EXISTS bc_rejected_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS bc_rejected_by INTEGER,
ADD COLUMN IF NOT EXISTS bc_rejection_reason TEXT,
ADD COLUMN IF NOT EXISTS bc_gating_exempt BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN equipment_purchase_requests.proforma_signed_at IS 'Timestamp when signed proforma was uploaded (commercial certainty achieved)';
COMMENT ON COLUMN equipment_purchase_requests.commercial_certainty IS 'Flag indicating if commercial certainty has been achieved';
COMMENT ON COLUMN equipment_purchase_requests.bc_created_reason IS 'Reason BC was created: legacy_early, signed_proforma, manual';
COMMENT ON COLUMN equipment_purchase_requests.bc_locked_until_signed IS 'Legacy BCs created before signed proforma are locked until certainty is achieved';
COMMENT ON COLUMN equipment_purchase_requests.bc_status IS 'BC approval status: not_created, draft, in_review, approved, rejected';
COMMENT ON COLUMN equipment_purchase_requests.bc_submitted_at IS 'Timestamp when BC was submitted for approval';
COMMENT ON COLUMN equipment_purchase_requests.bc_submitted_by IS 'User ID who submitted BC for approval';
COMMENT ON COLUMN equipment_purchase_requests.bc_approved_at IS 'Timestamp when BC was approved';
COMMENT ON COLUMN equipment_purchase_requests.bc_approved_by IS 'User ID who approved BC';
COMMENT ON COLUMN equipment_purchase_requests.bc_rejected_at IS 'Timestamp when BC was rejected';
COMMENT ON COLUMN equipment_purchase_requests.bc_rejected_by IS 'User ID who rejected BC';
COMMENT ON COLUMN equipment_purchase_requests.bc_rejection_reason IS 'Reason for BC rejection';
COMMENT ON COLUMN equipment_purchase_requests.bc_gating_exempt IS 'Temporary exemption from BC gating for legacy records';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_proforma_signed_at
ON equipment_purchase_requests(proforma_signed_at) WHERE proforma_signed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_commercial_certainty
ON equipment_purchase_requests(commercial_certainty) WHERE commercial_certainty = true;

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_bc_status
ON equipment_purchase_requests(bc_status) WHERE bc_status IS NOT NULL;

-- Migration logic for existing data
-- Mark BCs created before this migration as legacy_early
UPDATE equipment_purchase_requests
SET
  bc_created_reason = 'legacy_early',
  bc_locked_until_signed = CASE
    WHEN proforma_signed_at IS NULL THEN true
    ELSE false
  END,
  bc_status = CASE
    WHEN bc_spreadsheet_id IS NOT NULL THEN 'approved'  -- Assume legacy BCs are approved
    ELSE 'not_created'
  END
WHERE bc_spreadsheet_id IS NOT NULL
  AND bc_created_reason IS NULL;

-- Mark BCs that were created after signed proforma (if any)
UPDATE equipment_purchase_requests
SET bc_created_reason = 'signed_proforma'
WHERE bc_spreadsheet_id IS NOT NULL
  AND proforma_signed_at IS NOT NULL
  AND bc_created_reason = 'legacy_early';

-- Set commercial_certainty for requests that have signed proforma
UPDATE equipment_purchase_requests
SET commercial_certainty = true
WHERE proforma_signed_at IS NOT NULL;

-- Mark legacy requests that are already in advanced states as exempt from gating
-- (they've already passed the contract stage, so gating would block them)
UPDATE equipment_purchase_requests
SET bc_gating_exempt = true
WHERE status IN ('pending_contract', 'completed')
  AND bc_spreadsheet_id IS NOT NULL;

-- Create audit log for migration
INSERT INTO audit_trail (
  action,
  module,
  entity,
  entity_id,
  details,
  created_at
) VALUES (
  'MIGRATE_BC_GATING',
  'equipment_purchases',
  'migration_043',
  '043',
  json_build_object(
    'description', 'Migration to add BC gating for contracts',
    'bc_records_migrated', (SELECT COUNT(*) FROM equipment_purchase_requests WHERE bc_spreadsheet_id IS NOT NULL),
    'legacy_exemptions', (SELECT COUNT(*) FROM equipment_purchase_requests WHERE bc_gating_exempt = true)
  ),
  NOW()
);
