-- Migration: 132_ca0104_pest_control
-- Description: Tablas maestras para "Control de Plagas" GXP/ISO (CA-01-04)

CREATE TABLE IF NOT EXISTS ca0104_traps_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_name VARCHAR(255) NOT NULL,
    trap_code VARCHAR(120) NOT NULL UNIQUE,
    pest_type VARCHAR(120) NOT NULL,
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('high', 'medium', 'low', 'critical')),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    coordinates JSONB,
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ca0104_inspections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    traps_map_id UUID NOT NULL REFERENCES ca0104_traps_map(id) ON DELETE RESTRICT,
    inspection_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    inspector_name VARCHAR(255) NOT NULL,
    findings TEXT,
    pest_evidence BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    qa_notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ca0104_vendor_api (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name VARCHAR(255) NOT NULL,
    api_endpoint VARCHAR(512) NOT NULL,
    api_key_ref VARCHAR(255),
    contact_email VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    description TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ca0104_toxicity (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inspection_id UUID REFERENCES ca0104_inspections(id) ON DELETE SET NULL,
    chemical_name VARCHAR(255) NOT NULL,
    toxicity_level VARCHAR(50) NOT NULL CHECK (toxicity_level IN ('low', 'medium', 'high', 'critical')),
    exposure_notes TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'review', 'approved', 'archived')),
    qa_notes TEXT,
    created_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_ca0104_traps_map_risk_level
  ON ca0104_traps_map (risk_level)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0104_traps_map_status
  ON ca0104_traps_map (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0104_inspections_traps_map_id
  ON ca0104_inspections (traps_map_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0104_inspections_status
  ON ca0104_inspections (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0104_vendor_api_status
  ON ca0104_vendor_api (status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0104_toxicity_inspection_id
  ON ca0104_toxicity (inspection_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ca0104_toxicity_status
  ON ca0104_toxicity (status)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION ca0104_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0104_traps_map_updated_at
BEFORE UPDATE ON ca0104_traps_map
FOR EACH ROW EXECUTE FUNCTION ca0104_touch_updated_at();

CREATE TRIGGER trg_ca0104_inspections_updated_at
BEFORE UPDATE ON ca0104_inspections
FOR EACH ROW EXECUTE FUNCTION ca0104_touch_updated_at();

CREATE TRIGGER trg_ca0104_vendor_api_updated_at
BEFORE UPDATE ON ca0104_vendor_api
FOR EACH ROW EXECUTE FUNCTION ca0104_touch_updated_at();

CREATE TRIGGER trg_ca0104_toxicity_updated_at
BEFORE UPDATE ON ca0104_toxicity
FOR EACH ROW EXECUTE FUNCTION ca0104_touch_updated_at();
