-- Migration: Move BC creation to after signed proforma
-- Description: Add fields to track commercial certainty and BC creation timing

-- Add new fields to equipment_purchase_requests table
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS proforma_signed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS commercial_certainty BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bc_created_reason VARCHAR(50),
ADD COLUMN IF NOT EXISTS bc_locked_until_signed BOOLEAN DEFAULT false;

-- Add comments
COMMENT ON COLUMN equipment_purchase_requests.proforma_signed_at IS 'Timestamp when signed proforma was uploaded (commercial certainty achieved)';
COMMENT ON COLUMN equipment_purchase_requests.commercial_certainty IS 'Flag indicating if commercial certainty has been achieved';
COMMENT ON COLUMN equipment_purchase_requests.bc_created_reason IS 'Reason BC was created: legacy_early, signed_proforma, manual';
COMMENT ON COLUMN equipment_purchase_requests.bc_locked_until_signed IS 'Legacy BCs created before signed proforma are locked until certainty is achieved';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_proforma_signed_at
ON equipment_purchase_requests(proforma_signed_at) WHERE proforma_signed_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_commercial_certainty
ON equipment_purchase_requests(commercial_certainty) WHERE commercial_certainty = true;

-- Migration logic for existing data
-- Mark BCs created before this migration as legacy_early
UPDATE equipment_purchase_requests
SET
  bc_created_reason = 'legacy_early',
  bc_locked_until_signed = CASE
    WHEN proforma_signed_at IS NULL THEN true
    ELSE false
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

-- Create audit log for migration
INSERT INTO audit_trail (
  action,
  module,
  entity,
  entity_id,
  details,
  created_at
) VALUES (
  'MIGRATE_BC_TIMING',
  'equipment_purchases',
  'migration_043',
  '043',
  '{"description": "Migration to track BC creation timing after signed proforma", "affected_records": (SELECT COUNT(*) FROM equipment_purchase_requests WHERE bc_spreadsheet_id IS NOT NULL)}',
  NOW()
);