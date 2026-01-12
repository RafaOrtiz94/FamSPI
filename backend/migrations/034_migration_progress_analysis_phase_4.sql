/**
 * Migration: 034_migration_progress_analysis_phase_4.sql
 * Phase 4: Migration Progress Analysis - Business Case Wizard Database Normalization
 *
 * Description:
 * READ-ONLY analysis phase providing comprehensive observability into migration progress.
 * Creates views and queries to measure canonical vs legacy field usage across the system.
 *
 * Phase Type: OBSERVABILITY & METRICS (read-only)
 * Purpose: Assess Phase 5 readiness by measuring migration adoption
 * Impact: Zero downtime, zero data changes, zero code changes
 *
 * Analysis Areas:
 * - Database-level field usage patterns
 * - Migration completion percentages
 * - Data consistency validation
 * - Legacy field dependency assessment
 */

-- ======================================================
-- PHASE 4: MIGRATION PROGRESS ANALYSIS
-- Business Case Wizard Naming Normalization
-- ======================================================

-- ======================================================
-- STEP 1: LEGACY USAGE DETECTION MATRIX
-- ======================================================

-- Create comprehensive analysis of canonical vs legacy field usage
SELECT
    'LEGACY USAGE DETECTION MATRIX' as analysis_type,
    'business_case_type vs bc_purchase_type' as field_comparison,
    COUNT(*) as total_business_cases,
    COUNT(*) FILTER (WHERE business_case_type IS NOT NULL AND bc_purchase_type IS NOT NULL) as both_populated,
    COUNT(*) FILTER (WHERE business_case_type IS NOT NULL AND bc_purchase_type IS NULL) as canonical_only,
    COUNT(*) FILTER (WHERE business_case_type IS NULL AND bc_purchase_type IS NOT NULL) as legacy_only,
    COUNT(*) FILTER (WHERE business_case_type IS NULL AND bc_purchase_type IS NULL) as neither_populated,
    ROUND(
        COUNT(*) FILTER (WHERE business_case_type IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 2
    ) as canonical_adoption_percentage,
    CASE
        WHEN COUNT(*) FILTER (WHERE business_case_type IS NOT NULL AND bc_purchase_type IS NOT NULL) = COUNT(*) FILTER (WHERE bc_purchase_type IS NOT NULL)
        THEN '✅ FULL MIGRATION - All legacy data migrated'
        WHEN COUNT(*) FILTER (WHERE business_case_type IS NOT NULL AND bc_purchase_type IS NULL) > 0
        THEN '⚠️ NEW DATA ONLY - Legacy data not migrated'
        ELSE '❌ LEGACY DEPENDENCY - Still using legacy fields'
    END as migration_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'

UNION ALL

SELECT
    'LEGACY USAGE DETECTION MATRIX' as analysis_type,
    'calculation_mode vs bc_calculation_mode' as field_comparison,
    COUNT(*) as total_business_cases,
    COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL AND bc_calculation_mode IS NOT NULL) as both_populated,
    COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL AND bc_calculation_mode IS NULL) as canonical_only,
    COUNT(*) FILTER (WHERE calculation_mode IS NULL AND bc_calculation_mode IS NOT NULL) as legacy_only,
    COUNT(*) FILTER (WHERE calculation_mode IS NULL AND bc_calculation_mode IS NULL) as neither_populated,
    ROUND(
        COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 2
    ) as canonical_adoption_percentage,
    CASE
        WHEN COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL AND bc_calculation_mode IS NOT NULL) = COUNT(*) FILTER (WHERE bc_calculation_mode IS NOT NULL)
        THEN '✅ FULL MIGRATION - All legacy data migrated'
        WHEN COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL AND bc_calculation_mode IS NULL) > 0
        THEN '⚠️ NEW DATA ONLY - Legacy data not migrated'
        ELSE '❌ LEGACY DEPENDENCY - Still using legacy fields'
    END as migration_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'

UNION ALL

SELECT
    'LEGACY USAGE DETECTION MATRIX' as analysis_type,
    'includes_lis vs extra.lisIncludes' as field_comparison,
    COUNT(*) as total_business_cases,
    COUNT(*) FILTER (WHERE includes_lis IS NOT NULL AND (extra ? 'lisIncludes')) as both_populated,
    COUNT(*) FILTER (WHERE includes_lis IS NOT NULL AND NOT (extra ? 'lisIncludes')) as canonical_only,
    COUNT(*) FILTER (WHERE includes_lis IS NULL AND (extra ? 'lisIncludes')) as legacy_only,
    COUNT(*) FILTER (WHERE includes_lis IS NULL AND NOT (extra ? 'lisIncludes')) as neither_populated,
    ROUND(
        COUNT(*) FILTER (WHERE includes_lis IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 2
    ) as canonical_adoption_percentage,
    CASE
        WHEN COUNT(*) FILTER (WHERE includes_lis IS NOT NULL AND (extra ? 'lisIncludes')) = COUNT(*) FILTER (WHERE extra ? 'lisIncludes')
        THEN '✅ FULL MIGRATION - All legacy data migrated'
        WHEN COUNT(*) FILTER (WHERE includes_lis IS NOT NULL AND NOT (extra ? 'lisIncludes')) > 0
        THEN '⚠️ NEW DATA ONLY - Legacy data not migrated'
        ELSE '❌ LEGACY DEPENDENCY - Still using legacy fields'
    END as migration_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'

UNION ALL

SELECT
    'LEGACY USAGE DETECTION MATRIX' as analysis_type,
    'deadline_months vs extra.requirementsDeadlineMonths' as field_comparison,
    COUNT(*) as total_business_cases,
    COUNT(*) FILTER (WHERE deadline_months IS NOT NULL AND (extra ? 'requirementsDeadlineMonths')) as both_populated,
    COUNT(*) FILTER (WHERE deadline_months IS NOT NULL AND NOT (extra ? 'requirementsDeadlineMonths')) as canonical_only,
    COUNT(*) FILTER (WHERE deadline_months IS NULL AND (extra ? 'requirementsDeadlineMonths')) as legacy_only,
    COUNT(*) FILTER (WHERE deadline_months IS NULL AND NOT (extra ? 'requirementsDeadlineMonths')) as neither_populated,
    ROUND(
        COUNT(*) FILTER (WHERE deadline_months IS NOT NULL)::numeric /
        NULLIF(COUNT(*), 0) * 100, 2
    ) as canonical_adoption_percentage,
    CASE
        WHEN COUNT(*) FILTER (WHERE deadline_months IS NOT NULL AND (extra ? 'requirementsDeadlineMonths')) = COUNT(*) FILTER (WHERE extra ? 'requirementsDeadlineMonths')
        THEN '✅ FULL MIGRATION - All legacy data migrated'
        WHEN COUNT(*) FILTER (WHERE deadline_months IS NOT NULL AND NOT (extra ? 'requirementsDeadlineMonths')) > 0
        THEN '⚠️ NEW DATA ONLY - Legacy data not migrated'
        ELSE '❌ LEGACY DEPENDENCY - Still using legacy fields'
    END as migration_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- ======================================================
-- STEP 2: MIGRATION PROGRESS VIEW (READ-ONLY)
-- ======================================================

-- Create a view for ongoing migration monitoring
-- This view can be queried safely in production
CREATE OR REPLACE VIEW migration_progress_business_case AS
WITH field_metrics AS (
    SELECT
        'business_case_type' as canonical_field,
        'bc_purchase_type' as legacy_field,
        COUNT(*) FILTER (WHERE business_case_type IS NOT NULL) as rows_using_canonical,
        COUNT(*) FILTER (WHERE bc_purchase_type IS NOT NULL) as rows_with_legacy_data,
        COUNT(*) FILTER (WHERE business_case_type IS NOT NULL AND bc_purchase_type IS NULL) as rows_canonical_only,
        COUNT(*) FILTER (WHERE business_case_type IS NULL AND bc_purchase_type IS NOT NULL) as rows_legacy_only,
        COUNT(*) FILTER (WHERE business_case_type IS NOT NULL AND bc_purchase_type IS NOT NULL AND business_case_type = bc_purchase_type) as rows_consistent
    FROM equipment_purchase_requests
    WHERE uses_modern_system = true AND bc_system_type = 'modern'

    UNION ALL

    SELECT
        'calculation_mode' as canonical_field,
        'bc_calculation_mode' as legacy_field,
        COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL) as rows_using_canonical,
        COUNT(*) FILTER (WHERE bc_calculation_mode IS NOT NULL) as rows_with_legacy_data,
        COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL AND bc_calculation_mode IS NULL) as rows_canonical_only,
        COUNT(*) FILTER (WHERE calculation_mode IS NULL AND bc_calculation_mode IS NOT NULL) as rows_legacy_only,
        COUNT(*) FILTER (WHERE calculation_mode IS NOT NULL AND bc_calculation_mode IS NOT NULL AND calculation_mode = bc_calculation_mode) as rows_consistent
    FROM equipment_purchase_requests
    WHERE uses_modern_system = true AND bc_system_type = 'modern'

    UNION ALL

    SELECT
        'includes_lis' as canonical_field,
        'extra.lisIncludes' as legacy_field,
        COUNT(*) FILTER (WHERE includes_lis IS NOT NULL) as rows_using_canonical,
        COUNT(*) FILTER (WHERE extra ? 'lisIncludes') as rows_with_legacy_data,
        COUNT(*) FILTER (WHERE includes_lis IS NOT NULL AND NOT (extra ? 'lisIncludes')) as rows_canonical_only,
        COUNT(*) FILTER (WHERE includes_lis IS NULL AND (extra ? 'lisIncludes')) as rows_legacy_only,
        COUNT(*) FILTER (WHERE includes_lis IS NOT NULL AND (extra ? 'lisIncludes') AND includes_lis = (extra->>'lisIncludes')::boolean) as rows_consistent
    FROM equipment_purchase_requests
    WHERE uses_modern_system = true AND bc_system_type = 'modern'

    UNION ALL

    SELECT
        'deadline_months' as canonical_field,
        'extra.requirementsDeadlineMonths' as legacy_field,
        COUNT(*) FILTER (WHERE deadline_months IS NOT NULL) as rows_using_canonical,
        COUNT(*) FILTER (WHERE extra ? 'requirementsDeadlineMonths') as rows_with_legacy_data,
        COUNT(*) FILTER (WHERE deadline_months IS NOT NULL AND NOT (extra ? 'requirementsDeadlineMonths')) as rows_canonical_only,
        COUNT(*) FILTER (WHERE deadline_months IS NULL AND (extra ? 'requirementsDeadlineMonths')) as rows_legacy_only,
        COUNT(*) FILTER (WHERE deadline_months IS NOT NULL AND (extra ? 'requirementsDeadlineMonths') AND deadline_months = (extra->>'requirementsDeadlineMonths')::integer) as rows_consistent
    FROM equipment_purchase_requests
    WHERE uses_modern_system = true AND bc_system_type = 'modern'
),
overall_stats AS (
    SELECT
        COUNT(*) as total_business_cases,
        COUNT(*) FILTER (WHERE uses_modern_system = true AND bc_system_type = 'modern') as modern_business_cases
    FROM equipment_purchase_requests
)
SELECT
    fm.canonical_field,
    fm.legacy_field,
    os.total_business_cases,
    os.modern_business_cases,
    fm.rows_using_canonical,
    fm.rows_with_legacy_data,
    fm.rows_canonical_only,
    fm.rows_legacy_only,
    fm.rows_consistent,
    ROUND(
        fm.rows_using_canonical::numeric /
        NULLIF(os.modern_business_cases, 0) * 100, 2
    ) as migration_percentage,
    CASE
        WHEN fm.rows_using_canonical = os.modern_business_cases THEN 'COMPLETE'
        WHEN fm.rows_using_canonical > 0 THEN 'IN_PROGRESS'
        ELSE 'NOT_STARTED'
    END as migration_status,
    CASE
        WHEN fm.rows_legacy_only > 0 THEN '⚠️ LEGACY DEPENDENCY'
        WHEN fm.rows_consistent < fm.rows_with_legacy_data THEN '⚠️ INCONSISTENCY DETECTED'
        ELSE '✅ HEALTHY'
    END as health_status,
    now() as last_updated
FROM field_metrics fm, overall_stats os;

-- Query the migration progress view
SELECT
    'MIGRATION PROGRESS VIEW RESULTS' as report_section,
    canonical_field,
    legacy_field,
    modern_business_cases as total_modern_bcs,
    rows_using_canonical,
    rows_with_legacy_data,
    rows_legacy_only,
    migration_percentage,
    migration_status,
    health_status
FROM migration_progress_business_case
ORDER BY migration_percentage DESC;

-- ======================================================
-- STEP 3: DETAILED MIGRATION HEALTH CHECK
-- ======================================================

-- Check for data consistency issues
SELECT
    'DATA CONSISTENCY HEALTH CHECK' as analysis_type,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE business_case_type != bc_purchase_type) as inconsistent_bc_types,
    COUNT(*) FILTER (WHERE calculation_mode != bc_calculation_mode) as inconsistent_calc_modes,
    COUNT(*) FILTER (WHERE includes_lis != (extra->>'lisIncludes')::boolean AND (extra ? 'lisIncludes')) as inconsistent_lis,
    COUNT(*) FILTER (WHERE deadline_months != (extra->>'requirementsDeadlineMonths')::integer AND (extra ? 'requirementsDeadlineMonths')) as inconsistent_deadlines,
    CASE
        WHEN COUNT(*) FILTER (WHERE business_case_type != bc_purchase_type) = 0
             AND COUNT(*) FILTER (WHERE calculation_mode != bc_calculation_mode) = 0
             AND COUNT(*) FILTER (WHERE includes_lis != (extra->>'lisIncludes')::boolean AND (extra ? 'lisIncludes')) = 0
             AND COUNT(*) FILTER (WHERE deadline_months != (extra->>'requirementsDeadlineMonths')::integer AND (extra ? 'requirementsDeadlineMonths')) = 0
        THEN '✅ ALL DATA CONSISTENT'
        ELSE '❌ DATA INCONSISTENCIES DETECTED'
    END as consistency_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- ======================================================
-- STEP 4: MIGRATION READINESS ASSESSMENT
-- ======================================================

WITH migration_readiness AS (
    SELECT
        COUNT(*) as total_fields,
        COUNT(*) FILTER (WHERE migration_status = 'COMPLETE') as completed_fields,
        COUNT(*) FILTER (WHERE migration_status = 'IN_PROGRESS') as in_progress_fields,
        COUNT(*) FILTER (WHERE migration_status = 'NOT_STARTED') as not_started_fields,
        COUNT(*) FILTER (WHERE health_status LIKE '⚠️%') as fields_with_warnings,
        COUNT(*) FILTER (WHERE health_status = '❌ DATA INCONSISTENCIES DETECTED') as fields_with_errors,
        ROUND(
            AVG(migration_percentage) FILTER (WHERE migration_percentage > 0), 2
        ) as average_migration_percentage
    FROM migration_progress_business_case
)
SELECT
    'PHASE 5 READINESS ASSESSMENT' as assessment_type,
    total_fields,
    completed_fields,
    in_progress_fields,
    not_started_fields,
    fields_with_warnings,
    fields_with_errors,
    average_migration_percentage,
    CASE
        WHEN fields_with_errors > 0 THEN '❌ BLOCKED - Fix data inconsistencies first'
        WHEN completed_fields = total_fields THEN '✅ READY FOR PHASE 5 - All fields migrated'
        WHEN average_migration_percentage >= 95 THEN '✅ READY FOR PHASE 5 - Near complete migration'
        WHEN fields_with_warnings = 0 AND in_progress_fields > 0 THEN '⚠️ PARTIALLY READY - Some fields still migrating'
        ELSE '❌ NOT READY - Significant migration remaining'
    END as phase_5_readiness,
    CASE
        WHEN fields_with_errors > 0 THEN 'Address data consistency issues before proceeding'
        WHEN completed_fields = total_fields THEN 'All canonical fields fully adopted - safe to deprecate legacy fields'
        WHEN average_migration_percentage >= 95 THEN 'Migration nearly complete - minimal legacy dependency risk'
        ELSE 'Continue monitoring migration progress'
    END as recommendation
FROM migration_readiness;

-- ======================================================
-- STEP 5: ACTIONABLE INSIGHTS FOR PHASE 5
-- ======================================================

-- Identify specific rows that still depend on legacy fields
SELECT
    'LEGACY DEPENDENCY ANALYSIS' as insight_type,
    id,
    client_name,
    CASE
        WHEN business_case_type IS NULL AND bc_purchase_type IS NOT NULL THEN 'Uses legacy: bc_purchase_type'
        WHEN calculation_mode IS NULL AND bc_calculation_mode IS NOT NULL THEN 'Uses legacy: bc_calculation_mode'
        WHEN includes_lis IS NULL AND (extra ? 'lisIncludes') THEN 'Uses legacy: extra.lisIncludes'
        WHEN deadline_months IS NULL AND (extra ? 'requirementsDeadlineMonths') THEN 'Uses legacy: extra.requirementsDeadlineMonths'
        ELSE 'Fully migrated'
    END as legacy_dependency_reason,
    created_at,
    updated_at
FROM equipment_purchase_requests
WHERE uses_modern_system = true
  AND bc_system_type = 'modern'
  AND (
      (business_case_type IS NULL AND bc_purchase_type IS NOT NULL) OR
      (calculation_mode IS NULL AND bc_calculation_mode IS NOT NULL) OR
      (includes_lis IS NULL AND (extra ? 'lisIncludes')) OR
      (deadline_months IS NULL AND (extra ? 'requirementsDeadlineMonths'))
  )
ORDER BY updated_at DESC
LIMIT 10;

-- ======================================================
-- DASHBOARD SUMMARY (for monitoring dashboards)
-- ======================================================

SELECT
    'MIGRATION DASHBOARD SUMMARY' as dashboard_section,
    now() as report_timestamp,
    COUNT(*) FILTER (WHERE migration_status = 'COMPLETE') as completed_migrations,
    COUNT(*) FILTER (WHERE migration_status = 'IN_PROGRESS') as in_progress_migrations,
    COUNT(*) FILTER (WHERE migration_status = 'NOT_STARTED') as pending_migrations,
    ROUND(AVG(migration_percentage), 2) as overall_migration_percentage,
    MAX(last_updated) as last_measurement
FROM migration_progress_business_case;

/*
EXPECTED RESULTS FOR PHASE 4:
- Migration progress visibility across all canonical fields
- Identification of remaining legacy dependencies
- Data consistency validation
- Clear Phase 5 readiness assessment

PHASE 4 SUCCESS CRITERIA:
- [x] Migration progress view created and queryable
- [x] Legacy usage patterns identified and quantified
- [x] Data consistency validated
- [x] Phase 5 readiness assessment provided
- [x] Actionable insights for next steps generated
*/
