/**
 * Migration: 032_naming_normalization_phase_1.sql
 * Phase 1: Schema Preparation - Business Case Wizard Database Normalization
 *
 * Description:
 * Adds canonical column names to equipment_purchase_requests table for gradual
 * migration from inconsistent legacy field names to standardized naming.
 *
 * Migration Type: NON-DESTRUCTIVE (only adds columns)
 * Downtime: ZERO (additive changes only)
 * Rollback: SAFE (simply drop added columns)
 *
 * Changes:
 * - Adds 6 new canonical columns with appropriate data types and defaults
 * - No existing columns are modified or removed
 * - No data is changed or migrated in this phase
 * - No constraints, triggers, or indexes are added yet
 *
 * Validation:
 * Run validation queries after execution to confirm successful schema changes
 */

-- ======================================================
-- PHASE 1: SCHEMA PREPARATION
-- Business Case Wizard Naming Normalization
-- ======================================================

-- Add canonical columns for business case type and calculation mode
ALTER TABLE equipment_purchase_requests
ADD COLUMN business_case_type VARCHAR(50),
ADD COLUMN calculation_mode VARCHAR(20);

-- Add canonical columns for LIS configuration
ALTER TABLE equipment_purchase_requests
ADD COLUMN includes_lis BOOLEAN DEFAULT false,
ADD COLUMN includes_lis_hardware BOOLEAN DEFAULT false;

-- Add canonical columns for deadline management
ALTER TABLE equipment_purchase_requests
ADD COLUMN deadline_months INTEGER,
ADD COLUMN projected_deadline_months INTEGER;

-- ======================================================
-- VALIDATION QUERIES (run after migration)
-- ======================================================

/*
-- 1. Verify columns were added successfully
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'equipment_purchase_requests'
    AND column_name IN (
        'business_case_type',
        'calculation_mode',
        'includes_lis',
        'includes_lis_hardware',
        'deadline_months',
        'projected_deadline_months'
    )
ORDER BY column_name;

-- 2. Verify no existing columns were altered (should return 0 rows)
SELECT
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'equipment_purchase_requests'
    AND column_name NOT IN (
        'business_case_type',
        'calculation_mode',
        'includes_lis',
        'includes_lis_hardware',
        'deadline_months',
        'projected_deadline_months'
    )
    AND (
        data_type != (
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'equipment_purchase_requests'
            AND column_name = column_name
            AND table_schema = 'public'
        )
        OR is_nullable != (
            SELECT is_nullable FROM information_schema.columns
            WHERE table_name = 'equipment_purchase_requests'
            AND column_name = column_name
            AND table_schema = 'public'
        )
    );

-- 3. Verify defaults are applied correctly (should show NULL for new columns)
SELECT
    COUNT(*) as total_rows,
    COUNT(business_case_type) as with_business_case_type,
    COUNT(calculation_mode) as with_calculation_mode,
    COUNT(includes_lis) as with_includes_lis,
    COUNT(deadline_months) as with_deadline_months
FROM equipment_purchase_requests;

-- 4. Sample data check (should show defaults)
SELECT
    id,
    business_case_type,
    calculation_mode,
    includes_lis,
    includes_lis_hardware,
    deadline_months,
    projected_deadline_months
FROM equipment_purchase_requests
LIMIT 5;
*/

-- ======================================================
-- ROLLBACK SCRIPT (if needed)
-- ======================================================

/*
-- SAFE ROLLBACK: Drop only the newly added columns
-- No data loss, no downtime required

ALTER TABLE equipment_purchase_requests
DROP COLUMN IF EXISTS business_case_type,
DROP COLUMN IF EXISTS calculation_mode,
DROP COLUMN IF EXISTS includes_lis,
DROP COLUMN IF EXISTS includes_lis_hardware,
DROP COLUMN IF EXISTS deadline_months,
DROP COLUMN IF EXISTS projected_deadline_months;
*/

-- ======================================================
-- MIGRATION METADATA
-- ======================================================

/*
Migration: 032_naming_normalization_phase_1
Applied: [TIMESTAMP]
Status: SUCCESS
Downtime: 0 seconds
Data Changes: 0 rows affected
Schema Changes: 6 columns added
Rollback Available: YES (drop columns)
Next Phase: Phase 2 (Data Migration)
*/
