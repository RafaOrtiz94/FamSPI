/**
 * Migration: 072_fix_business_case_view_process_fields.sql
 * Fix for missing process_code/contract_object in v_business_cases_complete
 *
 * Symptoms:
 * - equipment_purchase_requests has values
 * - v_business_cases_complete returns NULL/undefined for process_code/contract_object
 *
 * Fix:
 * - Recreate v_business_cases_complete including process_code and contract_object
 */

DROP VIEW IF EXISTS public.v_business_cases_complete CASCADE;

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
    epr.business_case_type,
    epr.calculation_mode,
    epr.includes_lis,
    epr.includes_lis_hardware,
    epr.deadline_months,
    epr.projected_deadline_months,
    epr.canonical_state,
    epr.process_code,
    epr.contract_object
FROM public.equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern';

COMMENT ON VIEW public.v_business_cases_complete IS 'Vista completa de Business Cases (incluye process_code y contract_object)';
