-- Rollback for Migration 021: Manual BC Form Tables

-- Drop tables in reverse order (respecting foreign keys)
DROP TABLE IF EXISTS public.bc_deliveries CASCADE;
DROP TABLE IF EXISTS public.bc_requirements CASCADE;
DROP TABLE IF EXISTS public.bc_lis_equipment_interfaces CASCADE;
DROP TABLE IF EXISTS public.bc_lis_integration CASCADE;
DROP TABLE IF EXISTS public.bc_equipment_details CASCADE;
DROP TABLE IF EXISTS public.bc_lab_environment CASCADE;

-- Remove columns from main table
ALTER TABLE public.equipment_purchase_requests
DROP COLUMN IF EXISTS process_code,
DROP COLUMN IF EXISTS contract_object;
