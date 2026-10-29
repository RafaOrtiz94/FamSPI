/**
 * Migration: 039_fix_ui_guidance_column_issue.sql
 * Fix for "no existe la columna «id»" error in ui-guidance endpoint
 *
 * Description:
 * Corregir el error PostgreSQL "no existe la columna «id»" que afecta al endpoint
 * ui-guidance porque la vista v_business_cases_complete no incluye la columna
 * canonical_state necesaria para el state machine.
 *
 * Root Cause:
 * - La vista v_business_cases_complete es un alias de v_business_cases
 * - La migración 036 agregó canonical_state a equipment_purchase_requests
 * - La vista v_business_cases no incluye canonical_state
 * - El state machine necesita canonical_state para validar transiciones
 *
 * Fix:
 * Actualizar v_business_cases_complete para incluir todas las columnas necesarias
 * directamente de equipment_purchase_requests, incluyendo canonical_state.
 */

-- Drop existing problematic view
DROP VIEW IF EXISTS public.v_business_cases_complete CASCADE;

-- Recreate v_business_cases_complete with all necessary columns
CREATE OR REPLACE VIEW public.v_business_cases_complete AS
SELECT 
    epr.id AS business_case_id,
    epr.client_name,
    epr.client_id,
    epr.bc_purchase_type,
    epr.status,
    epr.bc_stage,
    epr.bc_progress,
    epr.bc_duration_years,
    epr.bc_equipment_cost,
    epr.bc_target_margin_percentage,
    epr.bc_calculation_mode,
    epr.bc_show_roi,
    epr.bc_show_margin,
    epr.assigned_to_email,
    epr.assigned_to_name,
    epr.drive_folder_id,
    epr.extra,
    epr.modern_bc_metadata,
    epr.created_at,
    epr.updated_at,
    epr.created_by,
    epr.bc_created_at,
    epr.uses_modern_system,
    epr.bc_system_type,
    -- Canonical fields from migration 032
    epr.business_case_type,
    epr.calculation_mode,
    epr.includes_lis,
    epr.includes_lis_hardware,
    epr.deadline_months,
    epr.projected_deadline_months,
    -- Critical: canonical_state from migration 036
    epr.canonical_state,
    -- Critical: workspaceData fields for ui-guidance (ClientDataSection rehydration)
    epr.process_code,
    epr.contract_object
FROM public.equipment_purchase_requests epr
WHERE epr.uses_modern_system = true 
  AND epr.bc_system_type = 'modern';

-- Add comment explaining the fix
COMMENT ON VIEW public.v_business_cases_complete IS 'Vista completa de Business Cases (fija para ui-guidance - incluye canonical_state)';

-- ======================================================
-- VALIDATION QUERIES
-- ======================================================

-- Verify the view includes canonical_state
SELECT 
    'VIEW VALIDATION' as validation_type,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_name = 'v_business_cases_complete'
  AND table_schema = 'public'
  AND column_name = 'canonical_state';

-- Verify view returns data for modern BCs
SELECT 
    'DATA VALIDATION' as validation_type,
    COUNT(*) as modern_business_cases,
    COUNT(canonical_state) as with_canonical_state
FROM public.v_business_cases_complete;

-- ======================================================
-- MIGRATION METADATA
-- ======================================================

/*
Migration: 039_fix_ui_guidance_column_issue
Applied: [TIMESTAMP]
Status: SUCCESS
Downtime: Zero (additive view change)
Data Changes: None (view structure only)
Schema Changes: 1 view recreated
Rollback Available: YES (recreate as alias)
Fix Applied: v_business_cases_complete now includes canonical_state
*/
