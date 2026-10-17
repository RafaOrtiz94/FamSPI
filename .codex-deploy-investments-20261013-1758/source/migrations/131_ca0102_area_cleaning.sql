-- Migration: 131_ca0102_area_cleaning
-- Description: Tablas maestras para "Limpieza de Áreas" GXP/ISO (CA-01-02)

CREATE TABLE IF NOT EXISTS ca0102_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('high', 'medium', 'low', 'sterile')),
    required_frequency VARCHAR(100) NOT NULL, -- Ej: 'daily', 'weekly', 'bi-weekly'
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS ca0102_cleaning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES ca0102_areas(id) ON DELETE RESTRICT,
    cleaning_type VARCHAR(100) NOT NULL CHECK (cleaning_type IN ('routine', 'deep_cleaning', 'spill_recovery')),
    cleaning_agent_used VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'draft', -- State Machine: draft -> executed -> verified -> closed
    operator_notes TEXT,
    qa_notes TEXT,
    executed_by VARCHAR(255),
    verified_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_ca0102_logs_area ON ca0102_cleaning_logs(area_id);
CREATE INDEX idx_ca0102_logs_status ON ca0102_cleaning_logs(status) WHERE deleted_at IS NULL;
