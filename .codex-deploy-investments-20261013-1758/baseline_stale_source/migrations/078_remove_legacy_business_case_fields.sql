/**
 * Migration: 078_remove_legacy_business_case_fields.sql
 * Goal: Remove legacy Business Case (Google Sheets / approval gating) fields from equipment_purchase_requests.
 * Note: Workspace Business Case uses equipment_purchase_requests (modern) and business-case module.
 * This migration only removes legacy columns and tables tied to the old BC flow.
 */

-- Drop legacy BC items table (old flow)
DROP TABLE IF EXISTS public.equipment_purchase_bc_items CASCADE;

-- Drop and recreate unified view without legacy BC columns
DROP VIEW IF EXISTS public.v_unified_purchase_requests;

-- Drop legacy BC columns from equipment_purchase_requests (if they exist)
ALTER TABLE public.equipment_purchase_requests
  DROP COLUMN IF EXISTS bc_spreadsheet_id,
  DROP COLUMN IF EXISTS bc_spreadsheet_url,
  DROP COLUMN IF EXISTS bc_status,
  DROP COLUMN IF EXISTS bc_submitted_at,
  DROP COLUMN IF EXISTS bc_submitted_by,
  DROP COLUMN IF EXISTS bc_approved_at,
  DROP COLUMN IF EXISTS bc_approved_by,
  DROP COLUMN IF EXISTS bc_rejected_at,
  DROP COLUMN IF EXISTS bc_rejected_by,
  DROP COLUMN IF EXISTS bc_rejection_reason,
  DROP COLUMN IF EXISTS bc_gating_exempt,
  DROP COLUMN IF EXISTS bc_locked_until_signed,
  DROP COLUMN IF EXISTS bc_created_reason;

-- Recreate unified view without legacy BC fields
CREATE OR REPLACE VIEW public.v_unified_purchase_requests AS
SELECT
  COALESCE(r.id::text, epr.id::text)::integer as canonical_id,
  CASE WHEN r.id IS NOT NULL THEN 'v2' ELSE 'legacy' END as store,

  COALESCE(r.payload->>'client_name', epr.client_name) as client_name,
  COALESCE(r.payload->>'client_email', epr.client_email) as client_email,
  COALESCE((r.payload->>'assigned_to')::integer, epr.assigned_to) as assigned_to,
  COALESCE(r.payload->>'assigned_to_email', epr.assigned_to_email) as assigned_to_email,
  COALESCE(r.payload->>'assigned_to_name', epr.assigned_to_name) as assigned_to_name,
  COALESCE(r.payload->>'provider_email', epr.provider_email) as provider_email,

  COALESCE(r.payload->'equipment', to_jsonb(epr.equipment)) as equipment,

  COALESCE(r.status, epr.status) as status,
  CASE WHEN r.id IS NOT NULL THEN 'modern' ELSE 'legacy' END as system_type,

  COALESCE(r.payload->>'commercial_certainty', epr.commercial_certainty::text) as commercial_certainty,
  COALESCE(r.payload->>'proforma_signed_at', epr.proforma_signed_at::text) as proforma_signed_at,

  COALESCE(r.payload->>'proforma_file_id', epr.proforma_file_id) as proforma_file_id,
  COALESCE(r.payload->>'contract_file_id', epr.contract_file_id) as contract_file_id,

  COALESCE(r.payload->>'drive_folder_id', epr.drive_folder_id) as drive_folder_id,

  COALESCE(r.created_at, epr.created_at) as created_at,
  COALESCE(r.updated_at, epr.updated_at) as updated_at,
  r.id as v2_request_id,
  epr.id as legacy_purchase_id,
  epr.v2_migration_status,

  r.payload as v2_payload,
  epr.extra as legacy_extra

FROM requests r
FULL OUTER JOIN equipment_purchase_requests epr ON r.id = epr.v2_request_id
WHERE
  (r.id IS NULL OR r.request_type_id = (SELECT id FROM request_types WHERE code = 'F.ST-19'))
  AND (epr.id IS NULL OR epr.request_type = 'purchase');

-- Optional safety: clean legacy indexes if any were created explicitly
DO $$
DECLARE
  idx record;
BEGIN
  FOR idx IN
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'equipment_purchase_requests'
      AND indexname ILIKE '%bc_%'
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS public.%I', idx.indexname);
  END LOOP;
END $$;

-- Validation (non-blocking)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'equipment_purchase_requests'
  AND column_name ILIKE 'bc_%';
