-- Migration: 042_fix_hydration_data_population.sql
-- Description: Populate missing section data for existing business cases to fix hydration failures
-- Date: 2026-01-07

-- This migration fixes the root cause of hydration failures by ensuring all business cases
-- have their section data properly populated in the separate tables.

BEGIN;

-- LOG: Migration start
INSERT INTO migration_audit_log (migration_name, description, started_at)
VALUES ('042_fix_hydration_data_population', 'Populate missing section data for existing business cases to fix hydration failures', NOW());

-- STEP 1: Ensure all existing BCs have lab environment records
-- For BCs that don't have lab environment data, create empty records
INSERT INTO bc_lab_environment (
    business_case_id,
    work_days_per_week,
    shifts_per_day,
    hours_per_shift,
    quality_controls_per_shift,
    control_levels,
    routine_qc_frequency,
    special_tests,
    special_qc_frequency,
    created_at,
    updated_at
)
SELECT
    epr.id,
    NULL, -- work_days_per_week
    NULL, -- shifts_per_day
    NULL, -- hours_per_shift
    NULL, -- quality_controls_per_shift
    NULL, -- control_levels
    NULL, -- routine_qc_frequency
    NULL, -- special_tests
    NULL, -- special_qc_frequency
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM bc_lab_environment ble WHERE ble.business_case_id = epr.id
  );

-- STEP 2: Ensure all existing BCs have equipment details records
INSERT INTO bc_equipment_details (
    business_case_id,
    equipment_name,
    equipment_model,
    equipment_manufacturer,
    equipment_type,
    throughput_capacity,
    test_menu,
    interface_requirements,
    created_at,
    updated_at
)
SELECT
    epr.id,
    NULL, -- equipment_name
    NULL, -- equipment_model
    NULL, -- equipment_manufacturer
    NULL, -- equipment_type
    NULL, -- throughput_capacity
    NULL, -- test_menu
    NULL, -- interface_requirements
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM bc_equipment_details bed WHERE bed.business_case_id = epr.id
  );

-- STEP 3: Ensure all existing BCs have LIS integration records
INSERT INTO bc_lis_integration (
    business_case_id,
    current_lis_system,
    lis_vendor,
    integration_level,
    hl7_version,
    interface_type,
    middleware_required,
    data_mapping_complexity,
    go_live_timeline,
    created_at,
    updated_at
)
SELECT
    epr.id,
    NULL, -- current_lis_system
    NULL, -- lis_vendor
    NULL, -- integration_level
    NULL, -- hl7_version
    NULL, -- interface_type
    NULL, -- middleware_required
    NULL, -- data_mapping_complexity
    NULL, -- go_live_timeline
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM bc_lis_integration bli WHERE bli.business_case_id = epr.id
  );

-- STEP 4: Ensure all existing BCs have requirements records
INSERT INTO bc_requirements (
    business_case_id,
    sample_types,
    test_volumes,
    peak_periods,
    turnaround_times,
    accreditation_requirements,
    regulatory_compliance,
    workflow_requirements,
    created_at,
    updated_at
)
SELECT
    epr.id,
    NULL, -- sample_types
    NULL, -- test_volumes
    NULL, -- peak_periods
    NULL, -- turnaround_times
    NULL, -- accreditation_requirements
    NULL, -- regulatory_compliance
    NULL, -- workflow_requirements
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM bc_requirements br WHERE br.business_case_id = epr.id
  );

-- STEP 5: Ensure all existing BCs have deliveries records
INSERT INTO bc_deliveries (
    business_case_id,
    delivery_schedule,
    installation_requirements,
    training_requirements,
    validation_requirements,
    go_live_support,
    warranty_terms,
    maintenance_schedule,
    created_at,
    updated_at
)
SELECT
    epr.id,
    NULL, -- delivery_schedule
    NULL, -- installation_requirements
    NULL, -- training_requirements
    NULL, -- validation_requirements
    NULL, -- go_live_support
    NULL, -- warranty_terms
    NULL, -- maintenance_schedule
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM bc_deliveries bd WHERE bd.business_case_id = epr.id
  );

-- STEP 6: Update data ownership to mark sections as incomplete for BCs without data
-- This ensures the UI correctly shows which sections need data entry

-- Mark lab sections as incomplete where no data exists
INSERT INTO data_ownership (business_case_id, section_name, is_completed, created_at, updated_at)
SELECT
    epr.id,
    'lab',
    false,
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM data_ownership do
      WHERE do.business_case_id = epr.id AND do.section_name = 'lab'
  )
ON CONFLICT (business_case_id, section_name) DO NOTHING;

-- Mark equipment sections as incomplete where no data exists
INSERT INTO data_ownership (business_case_id, section_name, is_completed, created_at, updated_at)
SELECT
    epr.id,
    'equipment',
    false,
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM data_ownership do
      WHERE do.business_case_id = epr.id AND do.section_name = 'equipment'
  )
ON CONFLICT (business_case_id, section_name) DO NOTHING;

-- Mark lis sections as incomplete where no data exists
INSERT INTO data_ownership (business_case_id, section_name, is_completed, created_at, updated_at)
SELECT
    epr.id,
    'lis',
    false,
    NOW(),
    NOW()
FROM equipment_purchase_requests epr
WHERE epr.uses_modern_system = true
  AND epr.bc_system_type = 'modern'
  AND NOT EXISTS (
      SELECT 1 FROM data_ownership do
      WHERE do.business_case_id = epr.id AND do.section_name = 'lis'
  )
ON CONFLICT (business_case_id, section_name) DO NOTHING;

-- STEP 7: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_bc_lab_environment_business_case_id
ON bc_lab_environment(business_case_id);

CREATE INDEX IF NOT EXISTS idx_bc_equipment_details_business_case_id
ON bc_equipment_details(business_case_id);

CREATE INDEX IF NOT EXISTS idx_bc_lis_integration_business_case_id
ON bc_lis_integration(business_case_id);

CREATE INDEX IF NOT EXISTS idx_bc_requirements_business_case_id
ON bc_requirements(business_case_id);

CREATE INDEX IF NOT EXISTS idx_bc_deliveries_business_case_id
ON bc_deliveries(business_case_id);

-- LOG: Migration completion
UPDATE migration_audit_log
SET completed_at = NOW(),
    status = 'COMPLETED',
    records_affected = (
        SELECT COUNT(*) FROM equipment_purchase_requests
        WHERE uses_modern_system = true AND bc_system_type = 'modern'
    )
WHERE migration_name = '042_fix_hydration_data_population';

COMMIT;

-- ROLLBACK SCRIPT (for reference)
-- Note: This migration is NOT reversible as it creates required data structures
-- ROLLBACK;
-- DELETE FROM bc_lab_environment WHERE work_days_per_week IS NULL;
-- DELETE FROM bc_equipment_details WHERE equipment_name IS NULL;
-- DELETE FROM bc_lis_integration WHERE current_lis_system IS NULL;
-- DELETE FROM bc_requirements WHERE sample_types IS NULL;
-- DELETE FROM bc_deliveries WHERE delivery_schedule IS NULL;
-- DELETE FROM data_ownership WHERE is_completed = false AND created_at = (SELECT MAX(created_at) FROM data_ownership);
-- COMMIT;
