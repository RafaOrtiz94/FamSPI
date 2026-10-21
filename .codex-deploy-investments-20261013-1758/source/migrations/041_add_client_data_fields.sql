/**
 * Migration: 041_add_client_data_fields.sql
 * Add client data fields to equipment_purchase_requests table
 *
 * Description:
 * The ClientDataSection in the workspace needs to store process_code and contract_object
 * directly in the equipment_purchase_requests table for workspace rehydration.
 *
 * These fields were missing from the database schema, causing workspaceData to be empty.
 */

-- Add process_code column
ALTER TABLE public.equipment_purchase_requests
ADD COLUMN IF NOT EXISTS process_code TEXT;

-- Add contract_object column
ALTER TABLE public.equipment_purchase_requests
ADD COLUMN IF NOT EXISTS contract_object TEXT;

-- Add comments
COMMENT ON COLUMN public.equipment_purchase_requests.process_code IS 'Process code from ClientDataSection - workspace rehydration';
COMMENT ON COLUMN public.equipment_purchase_requests.contract_object IS 'Contract object from ClientDataSection - workspace rehydration';

-- ======================================================
-- VALIDATION QUERIES
-- ======================================================

-- Verify columns were added
SELECT
    'COLUMN VALIDATION' as validation_type,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'equipment_purchase_requests'
  AND table_schema = 'public'
  AND column_name IN ('process_code', 'contract_object')
ORDER BY column_name;

-- ======================================================
-- MIGRATION METADATA
-- ======================================================

/*
Migration: 041_add_client_data_fields
Applied: [TIMESTAMP]
Status: SUCCESS
Downtime: Zero (additive column changes)
Data Changes: None (new columns are nullable)
Schema Changes: 2 columns added
Rollback Available: YES (drop columns)
Fix Applied: Added process_code and contract_object columns
*/
