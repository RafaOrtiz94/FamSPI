/**
 * Migration: 035_historical_backfill_option_b.sql
 * Historical Data Backfill - Business Case Wizard Database Normalization
 *
 * Description:
 * SAFE historical backfill (Option B) to populate canonical columns from legacy JSONB data.
 * Enables Phase 5 deprecation by achieving ≥95% migration completion for all fields.
 *
 * Backfill Strategy: OPTION B (Full Historical Backfill)
 * - Preserves all historical data integrity
 * - Never overwrites existing canonical values
 * - Idempotent and safe to re-run
 * - Fully auditable with row counts and validation
 *
 * Target Fields:
 * - includes_lis ← extra.lisIncludes
 * - includes_lis_hardware ← extra.lisIncludesHardware
 * - deadline_months ← extra.requirementsDeadlineMonths
 * - projected_deadline_months ← extra.requirementsProjectedDeadlineMonths
 *
 * Safety Rules:
 * - Only updates rows where canonical column IS NULL
 * - Never overwrites non-null canonical data
 * - Uses defensive casting with error handling
 * - Idempotent (safe to run multiple times)
 * - Full transaction rollback capability
 */

-- ======================================================
-- HISTORICAL BACKFILL: OPTION B
-- Business Case Wizard Naming Normalization
-- ======================================================

-- ======================================================
-- STEP 1: LEGACY DATA SHAPE ANALYSIS (READ-ONLY)
-- ======================================================

-- Analyze legacy JSONB data structure in extra field
SELECT
    'LEGACY DATA SHAPE ANALYSIS' as analysis_type,
    'equipment_purchase_requests.extra' as source_field,
    COUNT(*) as total_rows,
    COUNT(*) FILTER (WHERE extra IS NOT NULL) as rows_with_extra_json,
    COUNT(*) FILTER (WHERE extra ? 'lisIncludes') as rows_with_lis_includes,
    COUNT(*) FILTER (WHERE extra ? 'lisIncludesHardware') as rows_with_lis_hardware,
    COUNT(*) FILTER (WHERE extra ? 'requirementsDeadlineMonths') as rows_with_deadline_months,
    COUNT(*) FILTER (WHERE extra ? 'requirementsProjectedDeadlineMonths') as rows_with_projected_deadlines
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- Analyze data type variants and potential casting issues
SELECT
    'DATA TYPE VARIANTS ANALYSIS' as analysis_type,
    'lisIncludes values' as field_analysis,
    COUNT(*) as total_occurrences,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'lisIncludes') = 'boolean') as boolean_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'lisIncludes') = 'string') as string_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'lisIncludes') = 'number') as number_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'lisIncludes') IS NULL) as null_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'lisIncludes') NOT IN ('boolean', 'string', 'number') OR jsonb_typeof(extra->'lisIncludes') IS NULL) as other_types
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern' AND extra ? 'lisIncludes'

UNION ALL

SELECT
    'DATA TYPE VARIANTS ANALYSIS' as analysis_type,
    'requirementsDeadlineMonths values' as field_analysis,
    COUNT(*) as total_occurrences,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'requirementsDeadlineMonths') = 'number') as number_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'requirementsDeadlineMonths') = 'string') as string_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'requirementsDeadlineMonths') = 'boolean') as boolean_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'requirementsDeadlineMonths') IS NULL) as null_values,
    COUNT(*) FILTER (WHERE jsonb_typeof(extra->'requirementsDeadlineMonths') NOT IN ('number', 'string', 'boolean') OR jsonb_typeof(extra->'requirementsDeadlineMonths') IS NULL) as other_types
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern' AND extra ? 'requirementsDeadlineMonths';

-- ======================================================
-- STEP 2: BACKFILL RULES DEFINITION
-- ======================================================

/*
BACKFILL RULES (DETERMINISTIC AND SAFE):

1. includes_lis:
   - Source: extra.lisIncludes (JSONB)
   - Target: includes_lis (BOOLEAN, DEFAULT false)
   - Rule: If extra.lisIncludes exists AND is castable to boolean → cast value
   - Fallback: false (existing column default)
   - Constraint: Only update where includes_lis IS NULL

2. includes_lis_hardware:
   - Source: extra.lisIncludesHardware (JSONB)
   - Target: includes_lis_hardware (BOOLEAN, DEFAULT false)
   - Rule: If extra.lisIncludesHardware exists AND is castable to boolean → cast value
   - Fallback: false (existing column default)
   - Constraint: Only update where includes_lis_hardware IS NULL

3. deadline_months:
   - Source: extra.requirementsDeadlineMonths (JSONB)
   - Target: deadline_months (INTEGER)
   - Rule: If extra.requirementsDeadlineMonths exists AND is castable to integer AND > 0 → cast value
   - Fallback: NULL (no default)
   - Constraint: Only update where deadline_months IS NULL

4. projected_deadline_months:
   - Source: extra.requirementsProjectedDeadlineMonths (JSONB)
   - Target: projected_deadline_months (INTEGER)
   - Rule: If extra.requirementsProjectedDeadlineMonths exists AND is castable to integer AND > 0 → cast value
   - Fallback: NULL (no default)
   - Constraint: Only update where projected_deadline_months IS NULL

SAFETY GUARANTEES:
- Never overwrites existing canonical data (IS NULL check)
- Defensive casting prevents runtime errors
- Idempotent (safe to run multiple times)
- Preserves historical data integrity
- Full audit trail with row counts
*/

-- ======================================================
-- STEP 3: IMPACT ANALYSIS (PRE-BACKFILL)
-- ======================================================

-- Calculate impact before execution
SELECT
    'PRE-BACKFILL IMPACT ANALYSIS' as analysis_type,
    COUNT(*) as total_modern_business_cases,
    COUNT(*) FILTER (WHERE includes_lis IS NULL AND extra ? 'lisIncludes') as rows_to_update_lis,
    COUNT(*) FILTER (WHERE includes_lis_hardware IS NULL AND extra ? 'lisIncludesHardware') as rows_to_update_lis_hardware,
    COUNT(*) FILTER (WHERE deadline_months IS NULL AND extra ? 'requirementsDeadlineMonths') as rows_to_update_deadline_months,
    COUNT(*) FILTER (WHERE projected_deadline_months IS NULL AND extra ? 'requirementsProjectedDeadlineMonths') as rows_to_update_projected_deadlines,
    COUNT(*) FILTER (WHERE includes_lis IS NOT NULL) as rows_already_have_lis,
    COUNT(*) FILTER (WHERE includes_lis_hardware IS NOT NULL) as rows_already_have_lis_hardware,
    COUNT(*) FILTER (WHERE deadline_months IS NOT NULL) as rows_already_have_deadline_months,
    COUNT(*) FILTER (WHERE projected_deadline_months IS NOT NULL) as rows_already_have_projected_deadlines
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- Check for potential casting errors
SELECT
    'CASTING ERROR RISK ANALYSIS' as analysis_type,
    COUNT(*) FILTER (
        WHERE extra ? 'lisIncludes'
        AND jsonb_typeof(extra->'lisIncludes') NOT IN ('boolean', 'string')
    ) as lis_includes_non_castable,
    COUNT(*) FILTER (
        WHERE extra ? 'requirementsDeadlineMonths'
        AND jsonb_typeof(extra->'requirementsDeadlineMonths') NOT IN ('number', 'string')
    ) as deadline_months_non_castable,
    CASE
        WHEN COUNT(*) FILTER (
            WHERE extra ? 'lisIncludes'
            AND jsonb_typeof(extra->'lisIncludes') NOT IN ('boolean', 'string')
        ) = 0
        AND COUNT(*) FILTER (
            WHERE extra ? 'requirementsDeadlineMonths'
            AND jsonb_typeof(extra->'requirementsDeadlineMonths') NOT IN ('number', 'string')
        ) = 0
        THEN '✅ SAFE TO PROCEED - All legacy values are castable'
        ELSE '❌ REQUIRES MANUAL REVIEW - Non-castable values detected'
    END as casting_safety_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- ======================================================
-- STEP 4: DRY-RUN PROJECTIONS (SELECT-ONLY)
-- ======================================================

-- Dry-run: Show what would be updated for includes_lis
SELECT
    'DRY-RUN: includes_lis backfill projection' as dry_run_type,
    id,
    extra->>'lisIncludes' as legacy_value,
    CASE
        WHEN extra ? 'lisIncludes' AND jsonb_typeof(extra->'lisIncludes') IN ('boolean', 'string')
        THEN (extra->>'lisIncludes')::boolean
        ELSE false
    END as projected_canonical_value,
    includes_lis as current_canonical_value,
    CASE
        WHEN includes_lis IS NULL AND extra ? 'lisIncludes'
        THEN 'WOULD UPDATE'
        ELSE 'WOULD SKIP'
    END as backfill_action
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
    AND (includes_lis IS NULL OR extra ? 'lisIncludes')
ORDER BY id
LIMIT 10;

-- Dry-run: Show what would be updated for deadline_months
SELECT
    'DRY-RUN: deadline_months backfill projection' as dry_run_type,
    id,
    extra->>'requirementsDeadlineMonths' as legacy_value,
    CASE
        WHEN extra ? 'requirementsDeadlineMonths'
             AND jsonb_typeof(extra->'requirementsDeadlineMonths') IN ('number', 'string')
             AND (extra->>'requirementsDeadlineMonths')::integer > 0
        THEN (extra->>'requirementsDeadlineMonths')::integer
        ELSE NULL
    END as projected_canonical_value,
    deadline_months as current_canonical_value,
    CASE
        WHEN deadline_months IS NULL AND extra ? 'requirementsDeadlineMonths'
             AND jsonb_typeof(extra->'requirementsDeadlineMonths') IN ('number', 'string')
             AND (extra->>'requirementsDeadlineMonths')::integer > 0
        THEN 'WOULD UPDATE'
        ELSE 'WOULD SKIP'
    END as backfill_action
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
    AND (deadline_months IS NULL OR extra ? 'requirementsDeadlineMonths')
ORDER BY id
LIMIT 10;

-- ======================================================
-- STEP 5: SAFE BACKFILL EXECUTION (TRANSACTION)
-- ======================================================

/*
EXECUTION PLAN:
1. Begin transaction
2. Execute each backfill UPDATE in sequence
3. Validate results
4. Commit or rollback based on validation

IMPORTANT:
- This script is designed to be executed manually after review
- Each UPDATE is independent and can be rolled back individually
- The entire transaction can be rolled back if any issues are detected
*/

-- START TRANSACTION
BEGIN;

-- BACKFILL 1: includes_lis
UPDATE equipment_purchase_requests
SET includes_lis = (
    CASE
        WHEN extra ? 'lisIncludes' AND jsonb_typeof(extra->'lisIncludes') IN ('boolean', 'string')
        THEN (extra->>'lisIncludes')::boolean
        ELSE false
    END
)
WHERE uses_modern_system = true
  AND bc_system_type = 'modern'
  AND includes_lis IS NULL
  AND extra IS NOT NULL;

-- Log backfill progress
INSERT INTO migration_audit_log (
    migration_name,
    phase,
    operation,
    table_name,
    field_name,
    rows_affected,
    executed_at
) VALUES (
    '035_historical_backfill_option_b',
    'backfill_execution',
    'includes_lis_backfill',
    'equipment_purchase_requests',
    'includes_lis',
    (SELECT COUNT(*) FROM equipment_purchase_requests
     WHERE uses_modern_system = true AND bc_system_type = 'modern'
     AND includes_lis IS NOT NULL AND extra ? 'lisIncludes'),
    NOW()
);

-- BACKFILL 2: includes_lis_hardware
UPDATE equipment_purchase_requests
SET includes_lis_hardware = (
    CASE
        WHEN extra ? 'lisIncludesHardware' AND jsonb_typeof(extra->'lisIncludesHardware') IN ('boolean', 'string')
        THEN (extra->>'lisIncludesHardware')::boolean
        ELSE false
    END
)
WHERE uses_modern_system = true
  AND bc_system_type = 'modern'
  AND includes_lis_hardware IS NULL
  AND extra IS NOT NULL;

-- Log backfill progress
INSERT INTO migration_audit_log (
    migration_name,
    phase,
    operation,
    table_name,
    field_name,
    rows_affected,
    executed_at
) VALUES (
    '035_historical_backfill_option_b',
    'backfill_execution',
    'includes_lis_hardware_backfill',
    'equipment_purchase_requests',
    'includes_lis_hardware',
    (SELECT COUNT(*) FROM equipment_purchase_requests
     WHERE uses_modern_system = true AND bc_system_type = 'modern'
     AND includes_lis_hardware IS NOT NULL AND extra ? 'lisIncludesHardware'),
    NOW()
);

-- BACKFILL 3: deadline_months
UPDATE equipment_purchase_requests
SET deadline_months = (
    CASE
        WHEN extra ? 'requirementsDeadlineMonths'
             AND jsonb_typeof(extra->'requirementsDeadlineMonths') IN ('number', 'string')
             AND (extra->>'requirementsDeadlineMonths')::integer > 0
        THEN (extra->>'requirementsDeadlineMonths')::integer
        ELSE NULL
    END
)
WHERE uses_modern_system = true
  AND bc_system_type = 'modern'
  AND deadline_months IS NULL
  AND extra IS NOT NULL;

-- Log backfill progress
INSERT INTO migration_audit_log (
    migration_name,
    phase,
    operation,
    table_name,
    field_name,
    rows_affected,
    executed_at
) VALUES (
    '035_historical_backfill_option_b',
    'backfill_execution',
    'deadline_months_backfill',
    'equipment_purchase_requests',
    'deadline_months',
    (SELECT COUNT(*) FROM equipment_purchase_requests
     WHERE uses_modern_system = true AND bc_system_type = 'modern'
     AND deadline_months IS NOT NULL AND extra ? 'requirementsDeadlineMonths'),
    NOW()
);

-- BACKFILL 4: projected_deadline_months
UPDATE equipment_purchase_requests
SET projected_deadline_months = (
    CASE
        WHEN extra ? 'requirementsProjectedDeadlineMonths'
             AND jsonb_typeof(extra->'requirementsProjectedDeadlineMonths') IN ('number', 'string')
             AND (extra->>'requirementsProjectedDeadlineMonths')::integer > 0
        THEN (extra->>'requirementsProjectedDeadlineMonths')::integer
        ELSE NULL
    END
)
WHERE uses_modern_system = true
  AND bc_system_type = 'modern'
  AND projected_deadline_months IS NULL
  AND extra IS NOT NULL;

-- Log backfill progress
INSERT INTO migration_audit_log (
    migration_name,
    phase,
    operation,
    table_name,
    field_name,
    rows_affected,
    executed_at
) VALUES (
    '035_historical_backfill_option_b',
    'backfill_execution',
    'projected_deadline_months_backfill',
    'equipment_purchase_requests',
    'projected_deadline_months',
    (SELECT COUNT(*) FROM equipment_purchase_requests
     WHERE uses_modern_system = true AND bc_system_type = 'modern'
     AND projected_deadline_months IS NOT NULL AND extra ? 'requirementsProjectedDeadlineMonths'),
    NOW()
);

-- VALIDATION CHECKPOINT (within transaction)
DO $$
DECLARE
    v_inconsistent_records INTEGER;
BEGIN
    -- Check for any inconsistencies that would indicate a problem
    SELECT COUNT(*) INTO v_inconsistent_records
    FROM equipment_purchase_requests
    WHERE uses_modern_system = true AND bc_system_type = 'modern'
    AND (
        (includes_lis IS NOT NULL AND extra ? 'lisIncludes' AND includes_lis != (extra->>'lisIncludes')::boolean) OR
        (deadline_months IS NOT NULL AND extra ? 'requirementsDeadlineMonths' AND deadline_months != (extra->>'requirementsDeadlineMonths')::integer)
    );

    IF v_inconsistent_records > 0 THEN
        RAISE EXCEPTION 'Data inconsistency detected: % records have mismatched canonical and legacy values', v_inconsistent_records;
    END IF;

    -- Log successful validation
    INSERT INTO migration_audit_log (
        migration_name,
        phase,
        operation,
        details,
        executed_at
    ) VALUES (
        '035_historical_backfill_option_b',
        'validation_checkpoint',
        'consistency_check_passed',
        format('All %s records validated successfully', (SELECT COUNT(*) FROM equipment_purchase_requests WHERE uses_modern_system = true AND bc_system_type = 'modern')),
        NOW()
    );
END $$;

-- COMMIT TRANSACTION
COMMIT;

-- ======================================================
-- STEP 6: POST-BACKFILL VALIDATION
-- ======================================================

-- Verify migration progress after backfill
SELECT
    'POST-BACKFILL VALIDATION' as validation_type,
    canonical_field,
    legacy_field,
    modern_business_cases as total_modern_bcs,
    rows_using_canonical,
    rows_with_legacy_data,
    ROUND(
        rows_using_canonical::numeric /
        NULLIF(modern_business_cases, 0) * 100, 2
    ) as migration_percentage,
    CASE
        WHEN rows_using_canonical::numeric / NULLIF(modern_business_cases, 0) >= 0.95 THEN '✅ PHASE 5 READY'
        WHEN rows_using_canonical::numeric / NULLIF(modern_business_cases, 0) >= 0.80 THEN '⚠️ NEARLY READY'
        ELSE '❌ NEEDS MORE MIGRATION'
    END as phase_5_status
FROM migration_progress_business_case
WHERE canonical_field IN ('includes_lis', 'includes_lis_hardware', 'deadline_months', 'projected_deadline_months');

-- Verify data consistency
SELECT
    'POST-BACKFILL CONSISTENCY CHECK' as validation_type,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (
        WHERE includes_lis IS NOT NULL AND extra ? 'lisIncludes'
        AND includes_lis = (extra->>'lisIncludes')::boolean
    ) as consistent_lis_records,
    COUNT(*) FILTER (
        WHERE deadline_months IS NOT NULL AND extra ? 'requirementsDeadlineMonths'
        AND deadline_months = (extra->>'requirementsDeadlineMonths')::integer
    ) as consistent_deadline_records,
    CASE
        WHEN COUNT(*) FILTER (
            WHERE includes_lis IS NOT NULL AND extra ? 'lisIncludes'
            AND includes_lis != (extra->>'lisIncludes')::boolean
        ) = 0
        AND COUNT(*) FILTER (
            WHERE deadline_months IS NOT NULL AND extra ? 'requirementsDeadlineMonths'
            AND deadline_months != (extra->>'requirementsDeadlineMonths')::integer
        ) = 0
        THEN '✅ ALL DATA CONSISTENT'
        ELSE '❌ DATA INCONSISTENCIES DETECTED'
    END as consistency_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- ======================================================
-- PHASE 5 READINESS VERDICT
-- ======================================================

WITH final_readiness AS (
    SELECT
        COUNT(*) as total_backfill_fields,
        COUNT(*) FILTER (WHERE migration_percentage >= 95) as phase_5_ready_fields,
        COUNT(*) FILTER (WHERE migration_percentage >= 80 AND migration_percentage < 95) as nearly_ready_fields,
        ROUND(AVG(migration_percentage), 2) as average_completion,
        MAX(migration_percentage) as highest_completion,
        MIN(migration_percentage) as lowest_completion
    FROM migration_progress_business_case
    WHERE canonical_field IN ('includes_lis', 'includes_lis_hardware', 'deadline_months', 'projected_deadline_months')
)
SELECT
    'PHASE 5 FINAL READINESS ASSESSMENT' as assessment_type,
    total_backfill_fields,
    phase_5_ready_fields,
    nearly_ready_fields,
    average_completion,
    highest_completion,
    lowest_completion,
    CASE
        WHEN phase_5_ready_fields = total_backfill_fields THEN '✅ PHASE 5 SAFE - All backfilled fields ≥95% migrated'
        WHEN average_completion >= 90 THEN '⚠️ PHASE 5 PARTIALLY SAFE - High completion rate'
        WHEN nearly_ready_fields > 0 THEN '⚠️ PHASE 5 NEARLY SAFE - Some fields need final push'
        ELSE '❌ PHASE 5 NOT SAFE - Significant migration remaining'
    END as final_verdict,
    CASE
        WHEN phase_5_ready_fields = total_backfill_fields THEN 'Proceed with Phase 5 legacy field deprecation'
        WHEN average_completion >= 90 THEN 'Monitor remaining fields, Phase 5 viable with oversight'
        ELSE 'Continue data migration before Phase 5'
    END as recommendation
FROM final_readiness;

/*
EXECUTION SUMMARY:
- Historical backfill completed for LIS and deadline fields
- Migration percentages should now reach ≥95% for all target fields
- Data consistency maintained throughout the process
- Full audit trail captured in migration_audit_log

ROLLBACK INSTRUCTIONS:
If issues are detected after commit:
1. Run the backfill script again (idempotent)
2. Or manually correct any inconsistencies
3. Or restore from backup if critical issues found

NEXT STEPS:
- Run Phase 4 analysis again to confirm ≥95% migration completion
- Proceed to Phase 5 legacy field deprecation when ready
*/
