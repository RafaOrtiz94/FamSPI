-- Rollback for Migration 022: BC Master Unification

-- Drop views
DROP VIEW IF EXISTS v_bc_complete CASCADE;

-- Drop triggers
DROP TRIGGER IF EXISTS set_bc_number ON bc_master;
DROP TRIGGER IF EXISTS recalculate_on_determination_change ON bc_determinations;
DROP TRIGGER IF EXISTS recalculate_on_investment_change ON bc_investments;
DROP TRIGGER IF EXISTS recalculate_on_operational_change ON bc_operational_data;
DROP TRIGGER IF EXISTS recalculate_on_economic_change ON bc_economic_data;

-- Drop functions
DROP FUNCTION IF EXISTS generate_bc_number() CASCADE;
DROP FUNCTION IF EXISTS trigger_mark_for_recalculation() CASCADE;

-- Drop sequence
DROP SEQUENCE IF EXISTS bc_number_seq;

-- Drop tables (in reverse order of dependencies)
DROP TABLE IF EXISTS bc_validations CASCADE;
DROP TABLE IF EXISTS bc_workflow_history CASCADE;
DROP TABLE IF EXISTS bc_lis_equipment_interfaces CASCADE;
DROP TABLE IF EXISTS bc_lis_data CASCADE;
DROP TABLE IF EXISTS bc_operational_data CASCADE;
DROP TABLE IF EXISTS bc_economic_data CASCADE;

-- Remove columns from existing tables
ALTER TABLE bc_determinations DROP COLUMN IF EXISTS bc_master_id;
ALTER TABLE bc_investments DROP COLUMN IF EXISTS bc_master_id;

-- Drop central table
DROP TABLE IF EXISTS bc_master CASCADE;
