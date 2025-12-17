--
-- Rollback Script for Business Case Migrations (UPDATED)
-- Removes BC-specific columns and tables
--

-- Drop views first
DROP VIEW IF EXISTS public.v_business_cases_private CASCADE;
DROP VIEW IF EXISTS public.v_business_cases_public CASCADE;
DROP VIEW IF EXISTS public.v_business_cases CASCADE;

-- Drop BC-specific tables
DROP TABLE IF EXISTS public.bc_calculations CASCADE;
DROP TABLE IF EXISTS public.bc_investments CASCADE;
DROP TABLE IF EXISTS public.bc_determinations CASCADE;
DROP TABLE IF EXISTS public.bc_equipment_selection CASCADE;

-- Remove BC-specific columns from equipment_purchase_requests
ALTER TABLE public.equipment_purchase_requests
DROP COLUMN IF EXISTS bc_purchase_type,
DROP COLUMN IF EXISTS bc_duration_years,
DROP COLUMN IF EXISTS bc_equipment_cost,
DROP COLUMN IF EXISTS bc_target_margin_percentage,
DROP COLUMN IF EXISTS bc_amortization_months,
DROP COLUMN IF EXISTS bc_calculation_mode,
DROP COLUMN IF EXISTS bc_show_roi,
DROP COLUMN IF EXISTS bc_show_margin;

-- Note: This will remove ALL Business Case data
-- Make sure to backup before running this script
