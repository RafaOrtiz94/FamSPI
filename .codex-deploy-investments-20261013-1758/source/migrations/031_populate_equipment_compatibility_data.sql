-- Populate Equipment Compatibility Data
-- This script populates the new compatibility fields for existing equipment
-- Run this AFTER applying migration 030_equipment_compatibility_schema.sql

-- =============================================
-- HEMATOLOGY EQUIPMENT COMPATIBILITY GROUP
-- =============================================

-- Coulter Counter family (High-end hematology analyzers)
UPDATE public.equipment_models
SET
    compatibility_group = 'hematology_coulter',
    equipment_level = 3,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 95,
    redundancy_type = 'N+1',
    lease_price = 2500.00,
    maintenance_cost_monthly = 450.00,
    compatibility_rules = '{
        "backup_types": ["same_model", "same_manufacturer", "hematology_generic"],
        "capacity_overlap_min": 0.8,
        "max_cost_penalty": 25.0,
        "preferred_redundancy": "hot_standby"
    }'::jsonb
WHERE name ILIKE '%coulter%' OR name ILIKE '%beckman%' OR model ILIKE '%dxh%';

-- Mindray hematology analyzers
UPDATE public.equipment_models
SET
    compatibility_group = 'hematology_mindray',
    equipment_level = 2,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 85,
    redundancy_type = 'N+1',
    lease_price = 1800.00,
    maintenance_cost_monthly = 320.00,
    compatibility_rules = '{
        "backup_types": ["same_model", "hematology_generic"],
        "capacity_overlap_min": 0.7,
        "max_cost_penalty": 30.0
    }'::jsonb
WHERE manufacturer ILIKE '%mindray%' AND category_type = 'hematology';

-- Sysmex hematology systems
UPDATE public.equipment_models
SET
    compatibility_group = 'hematology_sysmex',
    equipment_level = 3,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 90,
    redundancy_type = 'N+1',
    lease_price = 2200.00,
    maintenance_cost_monthly = 380.00,
    compatibility_rules = '{
        "backup_types": ["same_model", "same_manufacturer", "hematology_generic"],
        "capacity_overlap_min": 0.75,
        "max_cost_penalty": 20.0,
        "preferred_redundancy": "parallel"
    }'::jsonb
WHERE manufacturer ILIKE '%sysmex%' AND category_type = 'hematology';

-- Generic hematology backup equipment
UPDATE public.equipment_models
SET
    compatibility_group = 'hematology_generic',
    equipment_level = 1,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 70,
    redundancy_type = 'cold_standby',
    lease_price = 1200.00,
    maintenance_cost_monthly = 200.00,
    compatibility_rules = '{
        "backup_types": ["hematology_generic"],
        "capacity_overlap_min": 0.6,
        "max_cost_penalty": 40.0,
        "emergency_use_only": true
    }'::jsonb
WHERE category_type = 'hematology'
  AND compatibility_group IS NULL;

-- =============================================
-- CHEMISTRY EQUIPMENT COMPATIBILITY GROUP
-- =============================================

-- Roche Cobas chemistry analyzers
UPDATE public.equipment_models
SET
    compatibility_group = 'chemistry_roche',
    equipment_level = 3,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 92,
    redundancy_type = 'N+1',
    lease_price = 3200.00,
    maintenance_cost_monthly = 580.00,
    compatibility_rules = '{
        "backup_types": ["same_model", "same_manufacturer", "chemistry_modular"],
        "capacity_overlap_min": 0.85,
        "max_cost_penalty": 15.0,
        "preferred_redundancy": "modular_redundancy"
    }'::jsonb
WHERE manufacturer ILIKE '%roche%' AND category_type = 'chemistry';

-- Beckman Coulter chemistry systems
UPDATE public.equipment_models
SET
    compatibility_group = 'chemistry_beckman',
    equipment_level = 3,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 88,
    redundancy_type = 'N+2',
    lease_price = 2800.00,
    maintenance_cost_monthly = 480.00,
    compatibility_rules = '{
        "backup_types": ["same_model", "chemistry_modular"],
        "capacity_overlap_min": 0.8,
        "max_cost_penalty": 20.0
    }'::jsonb
WHERE manufacturer ILIKE '%beckman%' AND category_type = 'chemistry';

-- Siemens chemistry analyzers
UPDATE public.equipment_models
SET
    compatibility_group = 'chemistry_siemens',
    equipment_level = 2,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 82,
    redundancy_type = 'N+1',
    lease_price = 2400.00,
    maintenance_cost_monthly = 420.00
WHERE manufacturer ILIKE '%siemens%' AND category_type = 'chemistry';

-- Ortho Clinical chemistry systems
UPDATE public.equipment_models
SET
    compatibility_group = 'chemistry_ortho',
    equipment_level = 2,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 80,
    redundancy_type = 'N+1',
    lease_price = 2200.00,
    maintenance_cost_monthly = 380.00
WHERE manufacturer ILIKE '%ortho%' AND category_type = 'chemistry';

-- Generic chemistry backup equipment
UPDATE public.equipment_models
SET
    compatibility_group = 'chemistry_generic',
    equipment_level = 1,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 65,
    redundancy_type = 'cold_standby',
    lease_price = 1500.00,
    maintenance_cost_monthly = 250.00,
    compatibility_rules = '{
        "backup_types": ["chemistry_generic"],
        "capacity_overlap_min": 0.5,
        "max_cost_penalty": 50.0,
        "emergency_use_only": true
    }'::jsonb
WHERE category_type = 'chemistry'
  AND compatibility_group IS NULL;

-- =============================================
-- COAGULATION EQUIPMENT COMPATIBILITY GROUP
-- =============================================

-- Stago coagulation analyzers
UPDATE public.equipment_models
SET
    compatibility_group = 'coagulation_stago',
    equipment_level = 2,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 78,
    redundancy_type = 'N+1',
    lease_price = 1900.00,
    maintenance_cost_monthly = 320.00
WHERE manufacturer ILIKE '%stago%' AND category_type = 'coagulation';

-- Siemens coagulation systems
UPDATE public.equipment_models
SET
    compatibility_group = 'coagulation_siemens',
    equipment_level = 2,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 75,
    redundancy_type = 'N+1',
    lease_price = 1800.00,
    maintenance_cost_monthly = 300.00
WHERE manufacturer ILIKE '%siemens%' AND category_type = 'coagulation';

-- Generic coagulation backup equipment
UPDATE public.equipment_models
SET
    compatibility_group = 'coagulation_generic',
    equipment_level = 1,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 60,
    redundancy_type = 'cold_standby',
    lease_price = 1200.00,
    maintenance_cost_monthly = 180.00,
    compatibility_rules = '{
        "backup_types": ["coagulation_generic"],
        "capacity_overlap_min": 0.6,
        "max_cost_penalty": 45.0
    }'::jsonb
WHERE category_type = 'coagulation'
  AND compatibility_group IS NULL;

-- =============================================
-- IMMUNOASSAY EQUIPMENT COMPATIBILITY GROUP
-- =============================================

-- Abbott Architect systems
UPDATE public.equipment_models
SET
    compatibility_group = 'immunoassay_abbott',
    equipment_level = 3,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 88,
    redundancy_type = 'N+1',
    lease_price = 3500.00,
    maintenance_cost_monthly = 620.00,
    compatibility_rules = '{
        "backup_types": ["same_model", "immunoassay_modular"],
        "capacity_overlap_min": 0.8,
        "max_cost_penalty": 18.0
    }'::jsonb
WHERE manufacturer ILIKE '%abbott%' AND (category_type ILIKE '%immuno%' OR category_type ILIKE '%inmuno%');

-- Beckman Coulter immunoassay
UPDATE public.equipment_models
SET
    compatibility_group = 'immunoassay_beckman',
    equipment_level = 2,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 82,
    redundancy_type = 'N+1',
    lease_price = 2800.00,
    maintenance_cost_monthly = 480.00
WHERE manufacturer ILIKE '%beckman%' AND (category_type ILIKE '%immuno%' OR category_type ILIKE '%inmuno%');

-- Generic immunoassay backup equipment
UPDATE public.equipment_models
SET
    compatibility_group = 'immunoassay_generic',
    equipment_level = 1,
    capacity_unit = 'tests/hour',
    capacity_type = 'throughput',
    backup_priority = 68,
    redundancy_type = 'cold_standby',
    lease_price = 1600.00,
    maintenance_cost_monthly = 280.00
WHERE (category_type ILIKE '%immuno%' OR category_type ILIKE '%inmuno%')
  AND compatibility_group IS NULL;

-- =============================================
-- MICROBIOLOGY EQUIPMENT COMPATIBILITY GROUP
-- =============================================

-- Microbiology analyzers and incubators
UPDATE public.equipment_models
SET
    compatibility_group = 'microbiology_incubators',
    equipment_level = 1,
    capacity_unit = 'samples/day',
    capacity_type = 'batch_processing',
    backup_priority = 55,
    redundancy_type = 'N+2',
    lease_price = 800.00,
    maintenance_cost_monthly = 120.00
WHERE category_type = 'microbiology' OR name ILIKE '%incubator%' OR name ILIKE '%microbiolog%';

-- =============================================
-- POINT-OF-CARE EQUIPMENT COMPATIBILITY GROUP
-- =============================================

-- POC analyzers (generally lower priority backups)
UPDATE public.equipment_models
SET
    compatibility_group = 'point_of_care',
    equipment_level = 1,
    capacity_unit = 'tests/hour',
    capacity_type = 'point_of_care',
    backup_priority = 40,
    redundancy_type = 'distributed',
    lease_price = 600.00,
    maintenance_cost_monthly = 80.00,
    compatibility_rules = '{
        "backup_types": ["point_of_care"],
        "capacity_overlap_min": 0.3,
        "max_cost_penalty": 60.0,
        "distributed_backup": true
    }'::jsonb
WHERE category_type ILIKE '%poc%' OR category_type ILIKE '%point%' OR name ILIKE '%poc%';

-- =============================================
-- CAPACITY FACTORS FOR DIFFERENT EQUIPMENT TYPES
-- =============================================

-- High-throughput analyzers
UPDATE public.equipment_models
SET capacity_factors = '{
    "peak_hours_multiplier": 1.2,
    "off_peak_multiplier": 0.7,
    "maintenance_downtime_percent": 5.0,
    "calibration_time_hours": 2.0,
    "reagent_changeover_time": 15,
    "operator_efficiency_factor": 0.95
}'::jsonb
WHERE capacity_per_hour > 200 AND category_type IN ('hematology', 'chemistry');

-- Medium-throughput analyzers
UPDATE public.equipment_models
SET capacity_factors = '{
    "peak_hours_multiplier": 1.1,
    "off_peak_multiplier": 0.8,
    "maintenance_downtime_percent": 3.0,
    "calibration_time_hours": 1.0,
    "reagent_changeover_time": 10,
    "operator_efficiency_factor": 0.92
}'::jsonb
WHERE capacity_per_hour BETWEEN 100 AND 200;

-- Low-throughput and specialty equipment
UPDATE public.equipment_models
SET capacity_factors = '{
    "peak_hours_multiplier": 1.0,
    "off_peak_multiplier": 0.9,
    "maintenance_downtime_percent": 2.0,
    "calibration_time_hours": 0.5,
    "reagent_changeover_time": 5,
    "operator_efficiency_factor": 0.88
}'::jsonb
WHERE capacity_per_hour < 100 OR category_type IN ('coagulation', 'microbiology', 'poc');

-- =============================================
-- AUTOMATION RULES FOR FUTURE AI RECOMMENDATIONS
-- =============================================

-- High-end equipment with AI automation potential
UPDATE public.equipment_models
SET automation_rules = '{
    "ai_recommendation_enabled": true,
    "predictive_maintenance": true,
    "usage_pattern_analysis": true,
    "cost_optimization_suggestions": true,
    "compatibility_scoring_weights": {
        "reliability": 0.3,
        "cost_efficiency": 0.25,
        "capacity_match": 0.25,
        "vendor_support": 0.2
    },
    "replacement_triggers": {
        "age_years": 7,
        "usage_hours": 20000,
        "failure_rate_threshold": 0.05
    }
}'::jsonb
WHERE equipment_level = 3;

-- Mid-range equipment
UPDATE public.equipment_models
SET automation_rules = '{
    "ai_recommendation_enabled": true,
    "predictive_maintenance": false,
    "usage_pattern_analysis": true,
    "cost_optimization_suggestions": true,
    "compatibility_scoring_weights": {
        "reliability": 0.4,
        "cost_efficiency": 0.3,
        "capacity_match": 0.2,
        "vendor_support": 0.1
    }
}'::jsonb
WHERE equipment_level = 2;

-- Basic equipment
UPDATE public.equipment_models
SET automation_rules = '{
    "ai_recommendation_enabled": false,
    "basic_compatibility_only": true,
    "compatibility_scoring_weights": {
        "reliability": 0.5,
        "cost_efficiency": 0.3,
        "capacity_match": 0.2
    }
}'::jsonb
WHERE equipment_level = 1;

-- =============================================
-- ESTABLISH EQUIPMENT HIERARCHIES
-- =============================================

-- Create parent-child relationships for equipment families
-- Example: Coulter DXH series hierarchy
UPDATE public.equipment_models
SET parent_equipment_id = (
    SELECT id FROM public.equipment_models
    WHERE name ILIKE '%coulter dxh%' AND manufacturer ILIKE '%beckman%'
    ORDER BY base_price DESC LIMIT 1
)
WHERE manufacturer ILIKE '%beckman%'
  AND category_type = 'hematology'
  AND name ILIKE '%coulter%'
  AND id != (
    SELECT id FROM public.equipment_models
    WHERE name ILIKE '%coulter dxh%' AND manufacturer ILIKE '%beckman%'
    ORDER BY base_price DESC LIMIT 1
  );

-- Roche Cobas family hierarchy
UPDATE public.equipment_models
SET parent_equipment_id = (
    SELECT id FROM public.equipment_models
    WHERE manufacturer ILIKE '%roche%' AND category_type = 'chemistry'
    ORDER BY base_price DESC LIMIT 1
)
WHERE manufacturer ILIKE '%roche%'
  AND category_type = 'chemistry'
  AND id != (
    SELECT id FROM public.equipment_models
    WHERE manufacturer ILIKE '%roche%' AND category_type = 'chemistry'
    ORDER BY base_price DESC LIMIT 1
  );

-- =============================================
-- POPULATE COMPATIBILITY MATRIX WITH EXPLICIT RELATIONSHIPS
-- =============================================

-- Insert explicit compatibility relationships
-- High compatibility between same manufacturer equipment
INSERT INTO public.equipment_compatibility_matrix (
    primary_equipment_id,
    backup_equipment_id,
    compatibility_score,
    capacity_overlap_percentage,
    cost_penalty_percentage,
    priority_score,
    notes
)
SELECT
    p.id as primary_equipment_id,
    b.id as backup_equipment_id,
    0.9 as compatibility_score,
    85.0 as capacity_overlap_percentage,
    10.0 as cost_penalty_percentage,
    80 as priority_score,
    'Same manufacturer high compatibility' as notes
FROM public.equipment_models p
CROSS JOIN public.equipment_models b
WHERE p.id != b.id
  AND p.manufacturer = b.manufacturer
  AND p.category_type = b.category_type
  AND p.status = 'operativo' AND b.status = 'operativo'
  AND NOT EXISTS (
    SELECT 1 FROM public.equipment_compatibility_matrix m
    WHERE m.primary_equipment_id = p.id AND m.backup_equipment_id = b.id
  );

-- Medium compatibility within same compatibility groups
INSERT INTO public.equipment_compatibility_matrix (
    primary_equipment_id,
    backup_equipment_id,
    compatibility_score,
    capacity_overlap_percentage,
    cost_penalty_percentage,
    priority_score,
    notes
)
SELECT
    p.id as primary_equipment_id,
    b.id as backup_equipment_id,
    0.75 as compatibility_score,
    70.0 as capacity_overlap_percentage,
    20.0 as cost_penalty_percentage,
    60 as priority_score,
    'Same compatibility group' as notes
FROM public.equipment_models p
CROSS JOIN public.equipment_models b
WHERE p.id != b.id
  AND p.compatibility_group = b.compatibility_group
  AND p.compatibility_group IS NOT NULL
  AND p.status = 'operativo' AND b.status = 'operativo'
  AND NOT EXISTS (
    SELECT 1 FROM public.equipment_compatibility_matrix m
    WHERE m.primary_equipment_id = p.id AND m.backup_equipment_id = b.id
  );

-- Emergency backup relationships (generic equipment)
INSERT INTO public.equipment_compatibility_matrix (
    primary_equipment_id,
    backup_equipment_id,
    compatibility_score,
    capacity_overlap_percentage,
    cost_penalty_percentage,
    priority_score,
    notes
)
SELECT
    p.id as primary_equipment_id,
    b.id as backup_equipment_id,
    0.6 as compatibility_score,
    50.0 as capacity_overlap_percentage,
    35.0 as cost_penalty_percentage,
    30 as priority_score,
    'Emergency backup - generic equipment' as notes
FROM public.equipment_models p
CROSS JOIN public.equipment_models b
WHERE p.id != b.id
  AND p.category_type = b.category_type
  AND b.compatibility_group LIKE '%generic%'
  AND p.compatibility_group NOT LIKE '%generic%'
  AND p.status = 'operativo' AND b.status = 'operativo'
  AND NOT EXISTS (
    SELECT 1 FROM public.equipment_compatibility_matrix m
    WHERE m.primary_equipment_id = p.id AND m.backup_equipment_id = b.id
  );

-- =============================================
-- VALIDATION AND LOGGING
-- =============================================

-- Log the population results
DO $$
DECLARE
    equipment_count INTEGER;
    matrix_entries INTEGER;
    groups_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO equipment_count
    FROM public.equipment_models
    WHERE compatibility_group IS NOT NULL;

    SELECT COUNT(*) INTO matrix_entries
    FROM public.equipment_compatibility_matrix
    WHERE is_active = true;

    SELECT COUNT(DISTINCT compatibility_group) INTO groups_count
    FROM public.equipment_models
    WHERE compatibility_group IS NOT NULL;

    RAISE NOTICE 'Equipment compatibility data population completed:';
    RAISE NOTICE '- Equipment with compatibility groups: %', equipment_count;
    RAISE NOTICE '- Active compatibility matrix entries: %', matrix_entries;
    RAISE NOTICE '- Unique compatibility groups: %', groups_count;
END $$;

-- =============================================
-- INDEX OPTIMIZATION FOR COMPATIBILITY QUERIES
-- =============================================

-- Ensure indexes are in place for performance
CREATE INDEX IF NOT EXISTS idx_equipment_compatibility_search
ON public.equipment_models(compatibility_group, category_type, status, backup_priority DESC)
WHERE compatibility_group IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_matrix_search
ON public.equipment_compatibility_matrix(primary_equipment_id, compatibility_score DESC, is_active)
WHERE is_active = true;

-- =============================================
-- DATA CONSISTENCY CHECKS
-- =============================================

-- Ensure all equipment has basic compatibility data
UPDATE public.equipment_models
SET
    equipment_level = COALESCE(equipment_level, 1),
    backup_priority = COALESCE(backup_priority, 50)
WHERE equipment_level IS NULL OR backup_priority IS NULL;

-- Validate compatibility matrix integrity
DELETE FROM public.equipment_compatibility_matrix
WHERE primary_equipment_id = backup_equipment_id;

-- Ensure matrix entries reference valid equipment
DELETE FROM public.equipment_compatibility_matrix m
WHERE NOT EXISTS (
    SELECT 1 FROM public.equipment_models p WHERE p.id = m.primary_equipment_id
)
OR NOT EXISTS (
    SELECT 1 FROM public.equipment_models b WHERE b.id = m.backup_equipment_id
);

COMMIT;
