/**
 * Migration: 037_business_case_state_machine_initialization.sql
 * Business Case State Machine - Initial State Population
 *
 * Description:
 * ONE-TIME SAFE MIGRATION to populate canonical_state column from existing
 * status and bc_stage fields. This initializes the state machine without
 * overwriting existing canonical_state values.
 *
 * Migration Logic (Exact Mapping):
 * - status = 'draft' → DRAFT_INICIAL
 * - bc_stage = 'pending_comercial' → DATOS_BASE_COMPLETOS
 * - bc_stage = 'pending_backoffice' → EN_EVALUACION_VIABILIDAD
 * - status = 'approved' → CERRADO_PARA_APROBACION
 * - status = 'rejected' → OBSERVADO_POR_VIABILIDAD
 * - ELSE → DRAFT_INICIAL
 *
 * Safety Rules:
 * - Only updates rows where canonical_state IS NULL
 * - Never overwrites existing canonical_state values
 * - Idempotent (safe to run multiple times)
 * - No transition logging (this is initialization, not workflow)
 * - Full validation before and after
 */

-- ======================================================
-- STATE MACHINE INITIALIZATION
-- Business Case Canonical State Population
-- ======================================================

-- ======================================================
-- STEP 1: PRE-MIGRATION ANALYSIS
-- ======================================================

-- Analyze current status and bc_stage distribution
SELECT
    'PRE-MIGRATION STATUS ANALYSIS' as analysis_type,
    status,
    bc_stage,
    COUNT(*) as record_count,
    CASE
        WHEN status = 'draft' THEN 'DRAFT_INICIAL'
        WHEN bc_stage = 'pending_comercial' THEN 'DATOS_BASE_COMPLETOS'
        WHEN bc_stage = 'pending_backoffice' THEN 'EN_EVALUACION_VIABILIDAD'
        WHEN status = 'approved' THEN 'CERRADO_PARA_APROBACION'
        WHEN status = 'rejected' THEN 'OBSERVADO_POR_VIABILIDAD'
        ELSE 'DRAFT_INICIAL'
    END as mapped_canonical_state
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
GROUP BY status, bc_stage
ORDER BY record_count DESC;

-- Check current canonical_state distribution (should be mostly NULL or default)
SELECT
    'PRE-MIGRATION CANONICAL STATE ANALYSIS' as analysis_type,
    canonical_state,
    COUNT(*) as record_count
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
GROUP BY canonical_state
ORDER BY record_count DESC;

-- Risk assessment for mappings
SELECT
    'MIGRATION RISK ASSESSMENT' as analysis_type,
    CASE
        WHEN status = 'draft' THEN 'LOW RISK - status = draft → DRAFT_INICIAL'
        WHEN bc_stage = 'pending_comercial' THEN 'MEDIUM RISK - bc_stage = pending_comercial → DATOS_BASE_COMPLETOS'
        WHEN bc_stage = 'pending_backoffice' THEN 'HIGH RISK - bc_stage = pending_backoffice → EN_EVALUACION_VIABILIDAD'
        WHEN status = 'approved' THEN 'LOW RISK - status = approved → CERRADO_PARA_APROBACION'
        WHEN status = 'rejected' THEN 'MEDIUM RISK - status = rejected → OBSERVADO_POR_VIABILIDAD'
        ELSE 'SAFE FALLBACK - ELSE → DRAFT_INICIAL'
    END as risk_assessment,
    COUNT(*) as affected_records
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
    AND canonical_state IS NULL
GROUP BY
    CASE
        WHEN status = 'draft' THEN 'LOW RISK - status = draft → DRAFT_INICIAL'
        WHEN bc_stage = 'pending_comercial' THEN 'MEDIUM RISK - bc_stage = pending_comercial → DATOS_BASE_COMPLETOS'
        WHEN bc_stage = 'pending_backoffice' THEN 'HIGH RISK - bc_stage = pending_backoffice → EN_EVALUACION_VIABILIDAD'
        WHEN status = 'approved' THEN 'LOW RISK - status = approved → CERRADO_PARA_APROBACION'
        WHEN status = 'rejected' THEN 'MEDIUM RISK - status = rejected → OBSERVADO_POR_VIABILIDAD'
        ELSE 'SAFE FALLBACK - ELSE → DRAFT_INICIAL'
    END
ORDER BY affected_records DESC;

-- ======================================================
-- STEP 2: SAFE INITIALIZATION MIGRATION
-- ======================================================

-- ONE-TIME UPDATE: Populate canonical_state from status/bc_stage
-- Only affects rows where canonical_state IS NULL (preserves existing values)

UPDATE equipment_purchase_requests
SET canonical_state = CASE
    WHEN status = 'draft' THEN 'DRAFT_INICIAL'
    WHEN bc_stage = 'pending_comercial' THEN 'DATOS_BASE_COMPLETOS'
    WHEN bc_stage = 'pending_backoffice' THEN 'EN_EVALUACION_VIABILIDAD'
    WHEN status = 'approved' THEN 'CERRADO_PARA_APROBACION'
    WHEN status = 'rejected' THEN 'OBSERVADO_POR_VIABILIDAD'
    ELSE 'DRAFT_INICIAL'
END
WHERE uses_modern_system = true
  AND bc_system_type = 'modern'
  AND canonical_state IS NULL;  -- SAFETY: Never overwrite existing canonical_state

-- ======================================================
-- STEP 3: POST-MIGRATION VALIDATION
-- ======================================================

-- Verify canonical_state population
SELECT
    'POST-MIGRATION STATE DISTRIBUTION' as validation_type,
    canonical_state,
    COUNT(*) as record_count
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
GROUP BY canonical_state
ORDER BY record_count DESC;

-- Verify no NULL canonical_state values remain
SELECT
    'NULL STATE VALIDATION' as validation_type,
    COUNT(*) FILTER (WHERE canonical_state IS NULL) as remaining_null_states,
    COUNT(*) as total_modern_business_cases,
    CASE
        WHEN COUNT(*) FILTER (WHERE canonical_state IS NULL) = 0
        THEN '✅ SUCCESS - All records have canonical_state'
        ELSE '❌ INCOMPLETE - Some records still have NULL canonical_state'
    END as completion_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- Verify mapping consistency (no logical contradictions)
SELECT
    'MAPPING CONSISTENCY VALIDATION' as validation_type,
    COUNT(*) as total_validations,
    COUNT(*) FILTER (
        (status = 'draft' AND canonical_state = 'DRAFT_INICIAL') OR
        (bc_stage = 'pending_comercial' AND canonical_state = 'DATOS_BASE_COMPLETOS') OR
        (bc_stage = 'pending_backoffice' AND canonical_state = 'EN_EVALUACION_VIABILIDAD') OR
        (status = 'approved' AND canonical_state = 'CERRADO_PARA_APROBACION') OR
        (status = 'rejected' AND canonical_state = 'OBSERVADO_POR_VIABILIDAD')
    ) as consistent_mappings,
    COUNT(*) FILTER (
        (status = 'draft' AND canonical_state != 'DRAFT_INICIAL') OR
        (bc_stage = 'pending_comercial' AND canonical_state != 'DATOS_BASE_COMPLETOS') OR
        (bc_stage = 'pending_backoffice' AND canonical_state != 'EN_EVALUACION_VIABILIDAD') OR
        (status = 'approved' AND canonical_state != 'CERRADO_PARA_APROBACION') OR
        (status = 'rejected' AND canonical_state != 'OBSERVADO_POR_VIABILIDAD')
    ) as inconsistent_mappings,
    CASE
        WHEN COUNT(*) FILTER (
            (status = 'draft' AND canonical_state != 'DRAFT_INICIAL') OR
            (bc_stage = 'pending_comercial' AND canonical_state != 'DATOS_BASE_COMPLETOS') OR
            (bc_stage = 'pending_backoffice' AND canonical_state != 'EN_EVALUACION_VIABILIDAD') OR
            (status = 'approved' AND canonical_state != 'CERRADO_PARA_APROBACION') OR
            (status = 'rejected' AND canonical_state != 'OBSERVADO_POR_VIABILIDAD')
        ) = 0 THEN '✅ ALL MAPPINGS CONSISTENT'
        ELSE '❌ MAPPING INCONSISTENCIES DETECTED'
    END as consistency_status
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern';

-- ======================================================
-- STEP 4: RISK SUMMARY FOR HIGH/MEDIUM MAPPINGS
-- ======================================================

-- HIGH RISK: bc_stage = 'pending_backoffice' → EN_EVALUACION_VIABILIDAD
SELECT
    'HIGH RISK MAPPING ANALYSIS' as risk_level,
    'bc_stage = pending_backoffice → EN_EVALUACION_VIABILIDAD' as mapping,
    COUNT(*) as affected_records,
    'HIGH RISK: Assumes all backoffice evaluations are viability assessments. May include different types of backoffice work.' as risk_description,
    'Monitor and potentially adjust state logic in business rules' as mitigation_strategy
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
    AND bc_stage = 'pending_backoffice';

-- MEDIUM RISK: bc_stage = 'pending_comercial' → DATOS_BASE_COMPLETOS
SELECT
    'MEDIUM RISK MAPPING ANALYSIS' as risk_level,
    'bc_stage = pending_comercial → DATOS_BASE_COMPLETOS' as mapping,
    COUNT(*) as affected_records,
    'MEDIUM RISK: Assumes pending_comercial means data is complete. Could be waiting for different reasons.' as risk_description,
    'Validate that pending_comercial truly indicates complete data entry' as mitigation_strategy
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
    AND bc_stage = 'pending_comercial';

-- MEDIUM RISK: status = 'rejected' → OBSERVADO_POR_VIABILIDAD
SELECT
    'MEDIUM RISK MAPPING ANALYSIS' as risk_level,
    'status = rejected → OBSERVADO_POR_VIABILIDAD' as mapping,
    COUNT(*) as affected_records,
    'MEDIUM RISK: Assumes rejected status means viability observations exist. May need rejection reason context.' as risk_description,
    'Consider adding rejection reason to determine appropriate state' as mitigation_strategy
FROM equipment_purchase_requests
WHERE uses_modern_system = true AND bc_system_type = 'modern'
    AND status = 'rejected';

-- ======================================================
-- STEP 5: MIGRATION AUDIT LOG
-- ======================================================

-- Log the initialization migration (not individual transitions)
INSERT INTO migration_audit_log (
    migration_name,
    phase,
    operation,
    table_name,
    field_name,
    rows_affected,
    details,
    executed_at
) VALUES (
    '037_business_case_state_machine_initialization',
    'state_initialization',
    'canonical_state_population',
    'equipment_purchase_requests',
    'canonical_state',
    (SELECT COUNT(*) FROM equipment_purchase_requests
     WHERE uses_modern_system = true AND bc_system_type = 'modern'
     AND canonical_state IS NOT NULL),
    jsonb_build_object(
        'mapping_logic', 'status/bc_stage to canonical_state using CASE logic',
        'safety_rules', 'Only updated NULL canonical_state values',
        'high_risk_mappings', (SELECT COUNT(*) FROM equipment_purchase_requests
                              WHERE uses_modern_system = true AND bc_system_type = 'modern'
                              AND bc_stage = 'pending_backoffice'),
        'medium_risk_mappings', (SELECT COUNT(*) FROM equipment_purchase_requests
                                WHERE uses_modern_system = true AND bc_system_type = 'modern'
                                AND (bc_stage = 'pending_comercial' OR status = 'rejected'))
    ),
    NOW()
);

-- ======================================================
-- MIGRATION SUMMARY
-- ======================================================

WITH migration_summary AS (
    SELECT
        COUNT(*) as total_modern_business_cases,
        COUNT(*) FILTER (WHERE canonical_state IS NOT NULL) as initialized_states,
        COUNT(*) FILTER (WHERE canonical_state = 'DRAFT_INICIAL') as draft_inicial_count,
        COUNT(*) FILTER (WHERE canonical_state = 'DATOS_BASE_COMPLETOS') as datos_completos_count,
        COUNT(*) FILTER (WHERE canonical_state = 'EN_EVALUACION_VIABILIDAD') as evaluacion_viabilidad_count,
        COUNT(*) FILTER (WHERE canonical_state = 'CERRADO_PARA_APROBACION') as cerrado_aprobacion_count,
        COUNT(*) FILTER (WHERE canonical_state = 'OBSERVADO_POR_VIABILIDAD') as observado_viabilidad_count
    FROM equipment_purchase_requests
    WHERE uses_modern_system = true AND bc_system_type = 'modern'
)
SELECT
    'MIGRATION COMPLETION SUMMARY' as summary_type,
    total_modern_business_cases,
    initialized_states,
    ROUND((initialized_states::numeric / total_modern_business_cases) * 100, 2) as completion_percentage,
    draft_inicial_count,
    datos_completos_count,
    evaluacion_viabilidad_count,
    cerrado_aprobacion_count,
    observado_viabilidad_count,
    CASE
        WHEN initialized_states = total_modern_business_cases THEN '✅ COMPLETE - All states initialized'
        WHEN initialized_states > 0 THEN '⚠️ PARTIAL - Some states initialized'
        ELSE '❌ FAILED - No states initialized'
    END as migration_status
FROM migration_summary;

/*
MIGRATION RESULTS SUMMARY:
- Records Processed: [total_modern_business_cases]
- States Initialized: [initialized_states]
- Completion Rate: [completion_percentage]%
- No Transitions Logged: This was initialization, not workflow movement

RISK SUMMARY:
- HIGH RISK: pending_backoffice → EN_EVALUACION_VIABILIDAD ([count] records)
- MEDIUM RISK: pending_comercial → DATOS_BASE_COMPLETOS ([count] records)
- MEDIUM RISK: rejected → OBSERVADO_POR_VIABILIDAD ([count] records)

NEXT STEPS:
- Validate state mappings in business logic
- Implement state transition validation
- Add transition logging for future state changes
*/
