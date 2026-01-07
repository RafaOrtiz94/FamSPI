-- Migration: Add legacy mapping for purchase requests unification
-- Description: Create 1:1 mapping between equipment_purchase_requests (legacy) and requests (V2)

-- Add mapping field to legacy table (preferred approach)
-- Note: requests.id is INTEGER, so v2_request_id must be INTEGER too
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS v2_request_id INTEGER REFERENCES requests(id);

-- Add unique constraint and index
ALTER TABLE equipment_purchase_requests
ADD CONSTRAINT unique_v2_request_id UNIQUE (v2_request_id);

CREATE INDEX IF NOT EXISTS idx_equipment_purchase_requests_v2_request_id
ON equipment_purchase_requests(v2_request_id) WHERE v2_request_id IS NOT NULL;

-- Add migration tracking
ALTER TABLE equipment_purchase_requests
ADD COLUMN IF NOT EXISTS v2_migration_status TEXT DEFAULT 'not_migrated'
CHECK (v2_migration_status IN ('not_migrated', 'pending', 'migrated', 'error'));

-- Add mapping field to V2 table for reverse lookup (optional, for debugging)
ALTER TABLE requests
ADD COLUMN IF NOT EXISTS legacy_purchase_id UUID;

-- Index for reverse lookup
CREATE INDEX IF NOT EXISTS idx_requests_legacy_purchase_id
ON requests(legacy_purchase_id) WHERE legacy_purchase_id IS NOT NULL;

-- Create view for unified purchase requests (shows both legacy and V2 data)
CREATE OR REPLACE VIEW v_unified_purchase_requests AS
SELECT
  -- Use V2 ID as canonical if exists, otherwise legacy ID
  COALESCE(r.id, epr.id) as canonical_id,
  CASE WHEN r.id IS NOT NULL THEN 'v2' ELSE 'legacy' END as store,

  -- Canonical fields (prefer V2, fallback to legacy)
  COALESCE(r.payload->>'client_name', epr.client_name) as client_name,
  COALESCE(r.payload->>'client_email', epr.client_email) as client_email,
  COALESCE((r.payload->>'assigned_to')::integer, epr.assigned_to) as assigned_to,
  COALESCE(r.payload->>'assigned_to_email', epr.assigned_to_email) as assigned_to_email,
  COALESCE(r.payload->>'assigned_to_name', epr.assigned_to_name) as assigned_to_name,
  COALESCE(r.payload->>'provider_email', epr.provider_email) as provider_email,

  -- Equipment (V2 format preferred)
  COALESCE(r.payload->'equipment', to_jsonb(epr.equipment)) as equipment,

  -- Status (V2 canonical state preferred)
  COALESCE(r.status, epr.status) as status,
  CASE WHEN r.id IS NOT NULL THEN 'modern' ELSE 'legacy' END as system_type,

  -- BC fields (V2 payload preferred)
  COALESCE(r.payload->>'bc_status', epr.bc_status) as bc_status,
  COALESCE(r.payload->>'bc_spreadsheet_id', epr.bc_spreadsheet_id) as bc_spreadsheet_id,
  COALESCE(r.payload->>'bc_approved_at', epr.bc_approved_at) as bc_approved_at,
  COALESCE(r.payload->>'commercial_certainty', epr.commercial_certainty::text) as commercial_certainty,
  COALESCE(r.payload->>'proforma_signed_at', epr.proforma_signed_at) as proforma_signed_at,

  -- File IDs
  COALESCE(r.payload->>'proforma_file_id', epr.proforma_file_id) as proforma_file_id,
  COALESCE(r.payload->>'contract_file_id', epr.contract_file_id) as contract_file_id,

  -- Drive folder
  COALESCE(r.payload->>'drive_folder_id', epr.drive_folder_id) as drive_folder_id,

  -- Metadata
  COALESCE(r.created_at, epr.created_at) as created_at,
  COALESCE(r.updated_at, epr.updated_at) as updated_at,
  r.id as v2_request_id,
  epr.id as legacy_purchase_id,
  epr.v2_migration_status,

  -- Raw data for debugging
  r.payload as v2_payload,
  epr.extra as legacy_extra

FROM requests r
FULL OUTER JOIN equipment_purchase_requests epr ON r.id = epr.v2_request_id
WHERE
  -- Only purchase requests (V2)
  (r.id IS NULL OR r.request_type_id = (SELECT id FROM request_types WHERE code = 'F.ST-19'))
  -- And legacy purchases
  AND (epr.id IS NULL OR epr.request_type = 'purchase');

-- Add comments
COMMENT ON COLUMN equipment_purchase_requests.v2_request_id IS 'Maps to canonical V2 request in requests table';
COMMENT ON COLUMN equipment_purchase_requests.v2_migration_status IS 'Migration status: not_migrated, pending, migrated, error';
COMMENT ON COLUMN requests.legacy_purchase_id IS 'Reverse mapping to legacy purchase for debugging';

-- Create audit log
INSERT INTO audit_trail (
  action,
  module,
  entity,
  entity_id,
  details,
  created_at
) VALUES (
  'CREATE_PURCHASE_MAPPING',
  'purchase_requests',
  'migration_044',
  '044',
  json_build_object(
    'description', 'Added legacy↔V2 mapping for purchase requests unification',
    'legacy_table', 'equipment_purchase_requests',
    'v2_table', 'requests',
    'mapping_field', 'v2_request_id',
    'unified_view', 'v_unified_purchase_requests'
  ),
  NOW()
);