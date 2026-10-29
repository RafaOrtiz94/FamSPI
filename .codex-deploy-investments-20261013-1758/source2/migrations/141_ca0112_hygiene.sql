-- CA-01-12: Prácticas de Higiene Personal
-- Migration: 141_ca0112_hygiene.sql

-- Tabla principal de evaluaciones de higiene
CREATE TABLE IF NOT EXISTS ca0112_hygiene_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES users(id),
    evaluation_date DATE NOT NULL,
    hygiene_area VARCHAR(100) NOT NULL,
    evaluation_type VARCHAR(50) NOT NULL CHECK (evaluation_type IN ('daily', 'weekly', 'monthly', 'procedural')),
    result VARCHAR(20) NOT NULL CHECK (result IN ('approved', 'conditionally_approved', 'failed')),
    observations TEXT,
    evaluated_by UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'verified')),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0112_hygiene_evaluations_employee ON ca0112_hygiene_evaluations(employee_id);
CREATE INDEX IF NOT EXISTS idx_ca0112_hygiene_evaluations_result ON ca0112_hygiene_evaluations(result);
CREATE INDEX IF NOT EXISTS idx_ca0112_hygiene_evaluations_date ON ca0112_hygiene_evaluations(evaluation_date);

-- Tabla de verificación de prácticas específicas
CREATE TABLE IF NOT EXISTS ca0112_practice_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES ca0112_hygiene_evaluations(id),
    practice_name VARCHAR(100) NOT NULL,
    practice_code VARCHAR(20) NOT NULL,
    is_complied BOOLEAN DEFAULT FALSE,
    severity VARCHAR(20) CHECK (severity IN ('critical', 'major', 'minor')),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0112_practice_verifications_evaluation ON ca0112_practice_verifications(evaluation_id);

-- Tabla de incumplimientos
CREATE TABLE IF NOT EXISTS ca0112_non_compliances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES ca0112_hygiene_evaluations(id),
    practice_id UUID REFERENCES ca0112_practice_verifications(id),
    description TEXT NOT NULL,
    non_compliance_type VARCHAR(50) NOT NULL CHECK (non_compliance_type IN ('hygiene', 'ppe', 'behavior', 'contamination')),
    corrective_action TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0112_non_compliances_evaluation ON ca0112_non_compliances(evaluation_id);

-- Tabla de equipos de protección personal
CREATE TABLE IF NOT EXISTS ca0112_ppe_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evaluation_id UUID NOT NULL REFERENCES ca0112_hygiene_evaluations(id),
    ppe_type VARCHAR(50) NOT NULL CHECK (ppe_type IN ('gloves', 'mask', 'gown', 'cap', 'goggles', 'boots', 'other')),
    is_used BOOLEAN DEFAULT FALSE,
    condition VARCHAR(20) CHECK (condition IN ('good', 'fair', 'poor')),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0112_ppe_checks_evaluation ON ca0112_ppe_checks(evaluation_id);

-- Tabla de capacitaciones de higiene
CREATE TABLE IF NOT EXISTS ca0112_trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID REFERENCES users(id),
    training_type VARCHAR(50) NOT NULL CHECK (training_type IN ('initial', 'refresher', 'specialized')),
    training_date DATE NOT NULL,
    trainer_id UUID REFERENCES users(id),
    duration_hours INTEGER,
    result VARCHAR(20) CHECK (result IN ('passed', 'failed', 'pending')),
    certificate_url VARCHAR(500),
    validity_date DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0112_trainings_employee ON ca0112_trainings(employee_id);
CREATE INDEX IF NOT EXISTS idx_ca0112_trainings_date ON ca0112_trainings(training_date);