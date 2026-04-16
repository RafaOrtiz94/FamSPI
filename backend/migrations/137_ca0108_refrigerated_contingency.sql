-- Migration: CA-01-08 (Plan de Contingencia Refrigerados) - Phase 1: Persistence
-- Author: Kilo Agent

BEGIN;

CREATE TABLE IF NOT EXISTS ca0108_power_outage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    outage_start TIMESTAMPTZ NOT NULL,
    outage_end TIMESTAMPTZ,
    duration_minutes INTEGER,
    cause VARCHAR(255),
    affected_areas TEXT,
    temperature_drop DECIMAL(5,2),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'resolved', 'investigated')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0108_dry_ice_calc (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    power_outage_id UUID REFERENCES ca0108_power_outage(id) ON DELETE CASCADE,
    container_volume_liters DECIMAL(10,2) NOT NULL,
    target_temp_celsius DECIMAL(5,2) NOT NULL,
    duration_hours DECIMAL(6,2) NOT NULL,
    required_ice_kg DECIMAL(10,2) NOT NULL,
    calculation_method VARCHAR(50),
    status VARCHAR(30) NOT NULL DEFAULT 'calculated' CHECK (status IN ('calculated', 'approved', 'used')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0108_transfer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    power_outage_id UUID REFERENCES ca0108_power_outage(id) ON DELETE CASCADE,
    from_location_id UUID NOT NULL,
    from_location_name VARCHAR(255) NOT NULL,
    to_location_id UUID NOT NULL,
    to_location_name VARCHAR(255) NOT NULL,
    products_affected INTEGER NOT NULL DEFAULT 0,
    transfer_status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (transfer_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0108_validation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    power_outage_id UUID REFERENCES ca0108_power_outage(id) ON DELETE CASCADE,
    validation_type VARCHAR(50) CHECK (validation_type IN ('temperature', 'product_integrity', 'transport', 'storage')),
    result TEXT,
    passed BOOLEAN,
    validated_by UUID,
    validated_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'passed', 'failed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_ca0108_power_status ON ca0108_power_outage(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0108_dry_ice_outage ON ca0108_dry_ice_calc(power_outage_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0108_transfer_outage ON ca0108_transfer(power_outage_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0108_validation_outage ON ca0108_validation(power_outage_id) WHERE is_deleted = FALSE;

CREATE OR REPLACE FUNCTION update_ca0108_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0108_power_updated BEFORE UPDATE ON ca0108_power_outage FOR EACH ROW EXECUTE FUNCTION update_ca0108_timestamp();
CREATE TRIGGER trg_ca0108_dry_ice_updated BEFORE UPDATE ON ca0108_dry_ice_calc FOR EACH ROW EXECUTE FUNCTION update_ca0108_timestamp();
CREATE TRIGGER trg_ca0108_transfer_updated BEFORE UPDATE ON ca0108_transfer FOR EACH ROW EXECUTE FUNCTION update_ca0108_timestamp();
CREATE TRIGGER trg_ca0108_validation_updated BEFORE UPDATE ON ca0108_validation FOR EACH ROW EXECUTE FUNCTION update_ca0108_timestamp();

COMMENT ON TABLE ca0108_power_outage IS 'Power outage events for refrigerated contingency';
COMMENT ON TABLE ca0108_dry_ice_calc IS 'Dry ice calculation records';
COMMENT ON TABLE ca0108_transfer IS 'Product transfer records during outages';
COMMENT ON TABLE ca0108_validation IS 'Validation records for product integrity';

COMMIT;