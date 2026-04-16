-- CA-01-11: Manejo de Derrames e Incidentes
-- Migration: 140_ca0111_spills_incidents.sql

-- Tabla principal de incidentes/derramess
CREATE TABLE IF NOT EXISTS ca0111_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_type VARCHAR(50) NOT NULL CHECK (incident_type IN ('spill', 'fire', 'security', 'equipment_failure', 'environmental', 'other')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    location VARCHAR(255),
    reported_by UUID REFERENCES users(id),
    reported_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(20) NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'contained', 'investigating', 'resolved', 'closed')),
    containment_notes TEXT,
    resolution_notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0111_incidents_status ON ca0111_incidents(status);
CREATE INDEX IF NOT EXISTS idx_ca0111_incidents_severity ON ca0111_incidents(severity);
CREATE INDEX IF NOT EXISTS idx_ca0111_incidents_incident_type ON ca0111_incidents(incident_type);

-- Tabla de acciones de containment
CREATE TABLE IF NOT EXISTS ca0111_containment_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES ca0111_incidents(id),
    action_description TEXT NOT NULL,
    responsible_id UUID REFERENCES users(id),
    action_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (action_status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    completed_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0111_containment_incident_id ON ca0111_containment_actions(incident_id);

-- Tabla de materiales peligrosos involucrados
CREATE TABLE IF NOT EXISTS ca0111_hazardous_materials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES ca0111_incidents(id),
    material_name VARCHAR(255) NOT NULL,
    quantity VARCHAR(50),
    unit VARCHAR(20),
    cas_number VARCHAR(50),
    hazard_class VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0111_hazardous_incident_id ON ca0111_hazardous_materials(incident_id);

-- Tabla de afectados (personas, areas)
CREATE TABLE IF NOT EXISTS ca0111_affected (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES ca0111_incidents(id),
    affected_type VARCHAR(20) NOT NULL CHECK (affected_type IN ('person', 'area', 'equipment', 'environment')),
    entity_name VARCHAR(255),
    description TEXT,
    quantity INTEGER DEFAULT 1,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0111_affected_incident_id ON ca0111_affected(incident_id);

-- Tabla decleanup/remediation actions
CREATE TABLE IF NOT EXISTS ca0111_cleanup_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES ca0111_incidents(id),
    cleanup_description TEXT NOT NULL,
    method_used VARCHAR(255),
    responsible_id UUID REFERENCES users(id),
    cleanup_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (cleanup_status IN ('pending', 'in_progress', 'completed', 'verified')),
    completed_at TIMESTAMP WITH TIME ZONE,
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0111_cleanup_incident_id ON ca0111_cleanup_actions(incident_id);