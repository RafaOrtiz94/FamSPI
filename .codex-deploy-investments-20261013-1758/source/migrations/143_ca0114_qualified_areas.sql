-- CA-01-14: Calificación Áreas Controladas
-- Migration: 143_ca0114_qualified_areas.sql

-- Tabla principal de áreas calificadas
CREATE TABLE IF NOT EXISTS ca0114_qualified_areas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_name VARCHAR(255) NOT NULL,
    area_code VARCHAR(50) NOT NULL,
    area_type VARCHAR(50) NOT NULL CHECK (area_type IN ('clean_room', 'warehouse', 'laboratory', 'production', 'storage', 'quarantine', 'other')),
    classification_level VARCHAR(20) NOT NULL CHECK (classification_level IN ('a', 'b', 'c', 'd', 'undefined')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'qualifying', 'qualified', 'suspended', 'requalification')),
    qualification_type VARCHAR(50) NOT NULL CHECK (qualification_type IN ('iq', 'oq', 'pq', 'initial', 'periodic', 'requalification')),
    qualification_date DATE,
    next_qualification_date DATE,
    last_qualification_result VARCHAR(20),
    validated_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0114_areas_area_type ON ca0114_qualified_areas(area_type);
CREATE INDEX IF NOT EXISTS idx_ca0114_areas_status ON ca0114_qualified_areas(status);
CREATE INDEX IF NOT EXISTS idx_ca0114_areas_classification ON ca0114_qualified_areas(classification_level);

-- Tabla de parámetros de calificación
CREATE TABLE IF NOT EXISTS ca0114_qualification_params (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES ca0114_qualified_areas(id),
    param_name VARCHAR(100) NOT NULL,
    param_code VARCHAR(50) NOT NULL,
    param_type VARCHAR(50) NOT NULL CHECK (param_type IN ('temperature', 'humidity', 'pressure', 'particulate', 'viable', 'nonviable', 'other')),
    min_value DECIMAL(10,2),
    max_value DECIMAL(10,2),
    target_value DECIMAL(10,2),
    unit VARCHAR(20),
    method_used VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0114_params_area ON ca0114_qualification_params(area_id);

-- Tabla de resultados de monitoreo
CREATE TABLE IF NOT EXISTS ca0114_monitoring_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES ca0114_qualified_areas(id),
    param_id UUID REFERENCES ca0114_qualification_params(id),
    reading_value DECIMAL(10,2),
    reading_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_within_spec BOOLEAN DEFAULT TRUE,
    notes TEXT,
    recorded_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0114_results_area ON ca0114_monitoring_results(area_id);

-- Tabla de desviaciones
CREATE TABLE IF NOT EXISTS ca0114_deviations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES ca0114_qualified_areas(id),
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
    corrective_action TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'closed')),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0114_deviations_area ON ca0114_deviations(area_id);

-- Tabla de documentos de calificación
CREATE TABLE IF NOT EXISTS ca0114_qualification_docs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    area_id UUID NOT NULL REFERENCES ca0114_qualified_areas(id),
    doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('protocol', 'report', 'certificate', 'sop', 'other')),
    doc_name VARCHAR(255) NOT NULL,
    doc_url VARCHAR(500),
    version VARCHAR(20),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0114_docs_area ON ca0114_qualification_docs(area_id);