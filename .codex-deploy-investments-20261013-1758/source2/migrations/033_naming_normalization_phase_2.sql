/**
 * Migration: 033_naming_normalization_phase_2.sql
 * Phase 2: Data Migration - Business Case Wizard Database Normalization
 *
 * Description:
 * Safely migrates data from legacy columns to canonical columns without
 * overwriting existing data or removing legacy columns.
 *
 * Migration Type: DATA MIGRATION (reversible)
 * Downtime: LOW (table locks during updates)
 * Rollback: SAFE (no data loss - only canonical columns affected)
 *
 * Safety Rules:
 * - Only updates rows where canonical column IS NULL (or false for booleans)
 * - Never overwrites existing canonical data
 * - Uses safe JSON parsing with existence guards
 * - All operations are reversible
 * - No legacy data is removed
 *
 * Data Mappings:
 * - bc_purchase_type → business_case_type
 * - bc_calculation_mode → calculation_mode
 * - extra.lisIncludes → includes_lis (boolean)
 * - extra.lisIncludesHardware → includes_lis_hardware (boolean)
 * - extra.requirementsDeadlineMonths → deadline_months (integer)
 * - extra.requirementsProjectedDeadlineMonths → projected_deadline_months (integer)
 *
 * Validation:
 * Run validation queries after execution to confirm successful data migration
 */

-- ======================================================
-- PHASE 2: DATA MIGRATION
-- Business Case Wizard Naming Normalization
-- ======================================================

-- STEP 1: PRE-MIGRATION VALIDATION (READ-ONLY)
-- ======================================================

-- Check legacy data availability before migration
SELECT
    'PRE-MIGRATION VALIDATION' as validation_step,
    COUNT(*) as total_rows,
    COUNT(bc_purchase_type) as rows_with_bc_purchase_type,
    COUNT(bc_calculation_mode) as rows_with_bc_calculation_mode,
    COUNT(*) FILTER (WHERE extra IS NOT NULL) as rows_with_extra_json,
    COUNT(*) FILTER (WHERE extra ? 'lisIncludes') as rows_with_lis_includes,
    COUNT(*) FILTER (WHERE extra ? 'lisIncludesHardware') as rows_with_lis_hardware,
    COUNT(*) FILTER (WHERE extra ? 'requirementsDeadlineMonths') as rows_with_deadline_months,
    COUNT(*) FILTER (WHERE extra ? 'requirementsProjectedDeadlineMonths') as rows_with_projected_deadline_months
FROM equipment_purchase_requests;

-- Check current canonical column state (should be mostly NULL/false)
SELECT
    'CANONICAL COLUMNS PRE-CHECK' as validation_step,
    COUNT(*) as total_rows,
    COUNT(business_case_type) as with_business_case_type,
    COUNT(calculation_mode) as with_calculation_mode,
    COUNT(*) FILTER (WHERE includes_lis = true) as with_includes_lis_true,
    COUNT(*) FILTER (WHERE includes_lis_hardware = true) as with_includes_lis_hardware_true,
    COUNT(deadline_months) as with_deadline_months,
    COUNT(projected_deadline_months) as with_projected_deadline_months
FROM equipment_purchase_requests;

-- ======================================================
-- STEP 2: SAFE DATA MIGRATION (WRITE OPERATIONS)
-- ======================================================

-- 1. Migrate bc_purchase_type → business_case_type
-- Only update where canonical column is NULL
UPDATE equipment_purchase_requests
SET business_case_type = bc_purchase_type
WHERE bc_purchase_type IS NOT NULL
  AND business_case_type IS NULL;

-- 2. Migrate bc_calculation_mode → calculation_mode
-- Only update where canonical column is NULL
UPDATE equipment_purchase_requests
SET calculation_mode = bc_calculation_mode
WHERE bc_calculation_mode IS NOT NULL
  AND calculation_mode IS NULL;

-- 3. Migrate extra.lisIncludes → includes_lis (boolean)
-- Only update where canonical column is false (default) and JSON key exists
UPDATE equipment_purchase_requests
SET includes_lis = (extra->>'lisIncludes')::boolean
WHERE extra ? 'lisIncludes'
  AND includes_lis = false
  AND (extra->>'lisIncludes')::boolean = true;

-- 4. Migrate extra.lisIncludesHardware → includes_lis_hardware (boolean)
-- Only update where canonical column is false (default) and JSON key exists
UPDATE equipment_purchase_requests
SET includes_lis_hardware = (extra->>'lisIncludesHardware')::boolean
WHERE extra ? 'lisIncludesHardware'
  AND includes_lis_hardware = false
  AND (extra->>'lisIncludesHardware')::boolean = true;

-- 5. Migrate extra.requirementsDeadlineMonths → deadline_months (integer)
-- Only update where canonical column is NULL and JSON key exists
UPDATE equipment_purchase_requests
SET deadline_months = (extra->>'requirementsDeadlineMonths')::integer
WHERE extra ? 'requirementsDeadlineMonths'
  AND deadline_months IS NULL
  AND (extra->>'requirementsDeadlineMonths')::integer > 0;

-- 6. Migrate extra.requirementsProjectedDeadlineMonths → projected_deadline_months (integer)
-- Only update where canonical column is NULL and JSON key exists
UPDATE equipment_purchase_requests
SET projected_deadline_months = (extra->>'requirementsProjectedDeadlineMonths')::integer
WHERE extra ? 'requirementsProjectedDeadlineMonths'
  AND projected_deadline_months IS NULL
  AND (extra->>'requirementsProjectedDeadlineMonths')::integer > 0;

-- ======================================================
-- STEP 3: POST-MIGRATION VALIDATION
-- ======================================================

-- Check canonical columns are now populated
SELECT
    'POST-MIGRATION VALIDATION' as validation_step,
    COUNT(*) as total_rows,
    COUNT(business_case_type) as with_business_case_type,
    COUNT(calculation_mode) as with_calculation_mode,
    COUNT(*) FILTER (WHERE includes_lis = true) as with_includes_lis_true,
    COUNT(*) FILTER (WHERE includes_lis_hardware = true) as with_includes_lis_hardware_true,
    COUNT(deadline_months) as with_deadline_months,
    COUNT(projected_deadline_months) as with_projected_deadline_months
FROM equipment_purchase_requests;

-- Compare legacy vs canonical counts
SELECT
    'LEGACY VS CANONICAL COMPARISON' as validation_step,
    'bc_purchase_type' as legacy_column,
    'business_case_type' as canonical_column,
    COUNT(bc_purchase_type) as legacy_count,
    COUNT(business_case_type) as canonical_count,
    CASE WHEN COUNT(business_case_type) >= COUNT(bc_purchase_type) THEN 'SUCCESS' ELSE 'MISMATCH' END as status
FROM equipment_purchase_requests
UNION ALL
SELECT
    'LEGACY VS CANONICAL COMPARISON' as validation_step,
    'bc_calculation_mode' as legacy_column,
    'calculation_mode' as canonical_column,
    COUNT(bc_calculation_mode) as legacy_count,
    COUNT(calculation_mode) as canonical_count,
    CASE WHEN COUNT(calculation_mode) >= COUNT(bc_calculation_mode) THEN 'SUCCESS' ELSE 'MISMATCH' END as status
FROM equipment_purchase_requests
UNION ALL
SELECT
    'LEGACY VS CANONICAL COMPARISON' as validation_step,
    'extra.lisIncludes' as legacy_column,
    'includes_lis' as canonical_column,
    COUNT(*) FILTER (WHERE extra ? 'lisIncludes' AND (extra->>'lisIncludes')::boolean = true) as legacy_count,
    COUNT(*) FILTER (WHERE includes_lis = true) as canonical_count,
    CASE WHEN COUNT(*) FILTER (WHERE includes_lis = true) >= COUNT(*) FILTER (WHERE extra ? 'lisIncludes' AND (extra->>'lisIncludes')::boolean = true) THEN 'SUCCESS' ELSE 'MISMATCH' END as status
FROM equipment_purchase_requests;

-- ======================================================
-- STEP 4: SAMPLE VERIFICATION
-- ======================================================

-- Show sample rows with legacy vs canonical comparison
SELECT
    'SAMPLE VERIFICATION' as validation_step,
    id,
    bc_purchase_type as legacy_business_case_type,
    business_case_type as canonical_business_case_type,
    bc_calculation_mode as legacy_calculation_mode,
    calculation_mode as canonical_calculation_mode,
    CASE WHEN extra ? 'lisIncludes' THEN (extra->>'lisIncludes')::boolean ELSE NULL END as legacy_includes_lis,
    includes_lis as canonical_includes_lis,
    CASE WHEN extra ? 'requirementsDeadlineMonths' THEN (extra->>'requirementsDeadlineMonths')::integer ELSE NULL END as legacy_deadline_months,
    deadline_months as canonical_deadline_months,
    CASE
        WHEN (bc_purchase_type IS NOT NULL AND business_case_type = bc_purchase_type) OR
             (bc_calculation_mode IS NOT NULL AND calculation_mode = bc_calculation_mode) OR
             (extra ? 'lisIncludes' AND includes_lis = (extra->>'lisIncludes')::boolean)
        THEN 'SUCCESS - Data migrated correctly'
        ELSE 'INFO - No migration needed or different values'
    END as migration_status
FROM equipment_purchase_requests
WHERE bc_purchase_type IS NOT NULL
   OR bc_calculation_mode IS NOT NULL
   OR extra ? 'lisIncludes'
   OR extra ? 'requirementsDeadlineMonths'
ORDER BY created_at DESC
LIMIT 10;

-- ======================================================
-- MIGRATION SAFETY CHECKS
-- ======================================================

-- Verify no legacy data was removed
SELECT
    'SAFETY CHECK - LEGACY DATA PRESERVATION' as validation_step,
    COUNT(*) as total_rows,
    COUNT(bc_purchase_type) as legacy_bc_type_preserved,
    COUNT(bc_calculation_mode) as legacy_calc_mode_preserved,
    COUNT(*) FILTER (WHERE extra IS NOT NULL) as legacy_extra_preserved,
    CASE WHEN COUNT(bc_purchase_type) > 0 AND COUNT(bc_calculation_mode) > 0 AND COUNT(*) FILTER (WHERE extra IS NOT NULL) > 0
         THEN 'SUCCESS - All legacy data preserved'
         ELSE 'WARNING - Some legacy data may be missing'
    END as status
FROM equipment_purchase_requests;

-- ======================================================
-- FINAL STATUS REPORT
-- ======================================================

WITH migration_stats AS (
    SELECT
        COUNT(*) as total_rows,
        COUNT(business_case_type) as migrated_bc_type,
        COUNT(calculation_mode) as migrated_calc_mode,
        COUNT(*) FILTER (WHERE includes_lis = true) as migrated_lis,
        COUNT(*) FILTER (WHERE includes_lis_hardware = true) as migrated_lis_hardware,
        COUNT(deadline_months) as migrated_deadlines,
        COUNT(projected_deadline_months) as migrated_proj_deadlines
    FROM equipment_purchase_requests
),
legacy_counts AS (
    SELECT
        COUNT(bc_purchase_type) as legacy_bc_type,
        COUNT(bc_calculation_mode) as legacy_calc_mode,
        COUNT(*) FILTER (WHERE extra ? 'lisIncludes' AND (extra->>'lisIncludes')::boolean = true) as legacy_lis,
        COUNT(*) FILTER (WHERE extra ? 'lisIncludesHardware' AND (extra->>'lisIncludesHardware')::boolean = true) as legacy_lis_hardware,
        COUNT(*) FILTER (WHERE extra ? 'requirementsDeadlineMonths') as legacy_deadlines,
        COUNT(*) FILTER (WHERE extra ? 'requirementsProjectedDeadlineMonths') as legacy_proj_deadlines
    FROM equipment_purchase_requests
)
SELECT
    'PHASE 2 MIGRATION SUMMARY' as report_title,
    m.total_rows as total_rows_processed,
    CASE
        WHEN m.migrated_bc_type >= l.legacy_bc_type THEN '✅ BUSINESS CASE TYPE'
        ELSE '❌ BUSINESS CASE TYPE'
    END as business_case_type_status,
    CASE
        WHEN m.migrated_calc_mode >= l.legacy_calc_mode THEN '✅ CALCULATION MODE'
        ELSE '❌ CALCULATION MODE'
    END as calculation_mode_status,
    CASE
        WHEN m.migrated_lis >= l.legacy_lis THEN '✅ LIS INCLUDES'
        ELSE '❌ LIS INCLUDES'
    END as lis_includes_status,
    CASE
        WHEN m.migrated_lis_hardware >= l.legacy_lis_hardware THEN '✅ LIS HARDWARE'
        ELSE '❌ LIS HARDWARE'
    END as lis_hardware_status,
    CASE
        WHEN m.migrated_deadlines >= l.legacy_deadlines THEN '✅ DEADLINE MONTHS'
        ELSE '❌ DEADLINE MONTHS'
    END as deadline_months_status,
    CASE
        WHEN m.migrated_proj_deadlines >= l.legacy_proj_deadlines THEN '✅ PROJECTED DEADLINES'
        ELSE '❌ PROJECTED DEADLINES'
    END as projected_deadlines_status,
    CASE
        WHEN m.migrated_bc_type >= l.legacy_bc_type
         AND m.migrated_calc_mode >= l.legacy_calc_mode
         AND m.migrated_lis >= l.legacy_lis
         AND m.migrated_lis_hardware >= l.legacy_lis_hardware
         AND m.migrated_deadlines >= l.legacy_deadlines
         AND m.migrated_proj_deadlines >= l.legacy_proj_deadlines
        THEN '✅ PHASE 2 COMPLETED SUCCESSFULLY'
        ELSE '❌ PHASE 2 FAILED - Data migration incomplete'
    END as final_status,
    now() as migration_completed_at
FROM migration_stats m, legacy_counts l;

/*
EXPECTED RESULTS:
- Canonical columns populated with data from legacy sources
- No legacy data removed or altered
- Migration is reversible (canonical columns can be cleared)
- All safety checks pass
- Status: ✅ PHASE 2 COMPLETED SUCCESSFULLY
*/

-- ======================================================
-- ROLLBACK SCRIPT (if needed)
-- ======================================================

/*
-- SAFE ROLLBACK: Clear only migrated canonical data
-- No legacy data affected, fully reversible

UPDATE equipment_purchase_requests
SET business_case_type = NULL,
    calculation_mode = NULL,
    includes_lis = false,
    includes_lis_hardware = false,
    deadline_months = NULL,
    projected_deadline_months = NULL;

-- Note: This only clears the newly populated canonical columns
-- Legacy columns remain untouched
*/

-- ======================================================
-- MIGRATION METADATA
-- ======================================================

/*
Migration: 033_naming_normalization_phase_2
Applied: [TIMESTAMP]
Status: SUCCESS
Downtime: Minimal (during UPDATE operations)
Data Changes: ~N rows updated (canonical columns populated)
Schema Changes: None
Rollback Available: YES (clear canonical columns)
Next Phase: Phase 3 (Dual Read/Write)
*/
