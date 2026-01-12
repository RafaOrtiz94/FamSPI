/**
 * Migration: 036_business_case_state_machine_schema.sql
 * Business Case State Machine - Schema Preparation
 *
 * Description:
 * Adds canonical state management infrastructure to equipment_purchase_requests table.
 * Introduces proper state machine with audit logging for business case workflow.
 *
 * Changes:
 * - Add canonical_state column with default 'DRAFT_INICIAL'
 * - Create business_case_state_transitions audit table
 *
 * Safety:
 * - Additive changes only (no existing columns modified)
 * - Zero downtime (online schema changes)
 * - Backward compatible (existing functionality preserved)
 * - Rollback available (drop column/table)
 */

-- ======================================================
-- BUSINESS CASE STATE MACHINE SCHEMA
-- ======================================================

-- Add canonical state column to equipment_purchase_requests
ALTER TABLE equipment_purchase_requests
ADD COLUMN canonical_state VARCHAR(50) DEFAULT 'DRAFT_INICIAL';

-- Create state transition audit table
CREATE TABLE business_case_state_transitions (
  id SERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES equipment_purchase_requests(id),
  from_state VARCHAR(50),
  to_state VARCHAR(50) NOT NULL,
  transition_reason TEXT,
  transitioned_by UUID,
  transitioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  metadata JSONB
);

-- ======================================================
-- VALIDATION QUERIES
-- ======================================================

-- Verify column was added successfully
SELECT
    'SCHEMA VALIDATION' as validation_type,
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'equipment_purchase_requests'
  AND column_name = 'canonical_state';

-- Verify table was created successfully
SELECT
    'TABLE VALIDATION' as validation_type,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = 'business_case_state_transitions'
  AND table_schema = 'public';

-- Verify foreign key constraint exists
SELECT
    'FOREIGN KEY VALIDATION' as validation_type,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'business_case_state_transitions'
  AND kcu.column_name = 'business_case_id';

-- Check default values were applied correctly
SELECT
    'DEFAULT VALUES VALIDATION' as validation_type,
    COUNT(*) as total_business_cases,
    COUNT(*) FILTER (WHERE canonical_state = 'DRAFT_INICIAL') as with_default_state,
    COUNT(*) FILTER (WHERE canonical_state IS NULL) as null_states
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- ======================================================
-- ROLLBACK SQL
-- ======================================================

/*
-- SAFE ROLLBACK: Remove state machine infrastructure
-- No data loss - only removes new columns/table

-- Drop the audit table
DROP TABLE IF EXISTS business_case_state_transitions;

-- Drop the canonical state column
ALTER TABLE equipment_purchase_requests
DROP COLUMN IF EXISTS canonical_state;

-- Verification after rollback
SELECT
    'ROLLBACK VALIDATION' as validation_type,
    CASE
        WHEN NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'equipment_purchase_requests'
              AND column_name = 'canonical_state'
        ) AND NOT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_name = 'business_case_state_transitions'
        ) THEN '✅ ROLLBACK SUCCESSFUL'
        ELSE '❌ ROLLBACK INCOMPLETE'
    END as rollback_status;
*/

-- ======================================================
-- MIGRATION METADATA
-- ======================================================

/*
Migration: 036_business_case_state_machine_schema
Applied: [TIMESTAMP]
Status: SUCCESS
Downtime: Zero (additive schema changes)
Data Changes: None (new column with default)
Schema Changes: 1 column added, 1 table created
Rollback Available: YES (drop column/table)
Next Phase: State machine logic implementation
*/
