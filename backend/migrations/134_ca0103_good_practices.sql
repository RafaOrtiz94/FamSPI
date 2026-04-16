-- Migration: CA-01-03 (Buenas Prácticas) - Phase 1: Persistence
-- Author: Kilo Agent
-- Description: Creates relational tables for Training, Exams, Certifications, and Violations with GXP audit support

BEGIN;

-- ========================================
-- CA0103_Training: Training sessions and records
-- ========================================
CREATE TABLE IF NOT EXISTS ca0103_training (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    training_type VARCHAR(50) NOT NULL CHECK (training_type IN ('induction', 'on_the_job', 'safety', 'technical', 'gmp', 'refresh')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date TIMESTAMPTZ NOT NULL,
    completed_date TIMESTAMPTZ,
    instructor VARCHAR(255),
    location VARCHAR(255),
    duration_hours DECIMAL(5,2),
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled', 'failed')),
    certificate_url TEXT,
    evaluation_score DECIMAL(5,2),
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0103_training_employee ON ca0103_training(employee_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_training_status ON ca0103_training(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_training_scheduled ON ca0103_training(scheduled_date) WHERE is_deleted = FALSE;

-- ========================================
-- CA0103_Exams: Training examinations and evaluations
-- ========================================
CREATE TABLE IF NOT EXISTS ca0103_exams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_id UUID REFERENCES ca0103_training(id) ON DELETE CASCADE,
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    exam_type VARCHAR(50) NOT NULL CHECK (exam_type IN ('written', 'practical', 'oral', 'online', 'certification')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    scheduled_date TIMESTAMPTZ NOT NULL,
    completed_date TIMESTAMPTZ,
    passing_score DECIMAL(5,2) NOT NULL DEFAULT 70.00,
    obtained_score DECIMAL(5,2),
    max_score DECIMAL(5,2) DEFAULT 100.00,
    result VARCHAR(20) CHECK (result IN ('passed', 'failed', 'pending', 'absent')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    evaluator_id UUID REFERENCES users(id),
    evaluation_notes TEXT,
    certificate_issued BOOLEAN NOT NULL DEFAULT FALSE,
    certificate_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0103_exams_training ON ca0103_exams(training_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_exams_employee ON ca0103_exams(employee_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_exams_result ON ca0103_exams(result) WHERE is_deleted = FALSE;

-- ========================================
-- CA0103_Certifications: Employee certifications and qualifications
-- ========================================
CREATE TABLE IF NOT EXISTS ca0103_certifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    certification_type VARCHAR(50) NOT NULL CHECK (certification_type IN ('gmp', 'safety', 'technical', 'quality', 'regulatory', 'specialty')),
    certification_name VARCHAR(255) NOT NULL,
    issuing_authority VARCHAR(255),
    issue_date DATE NOT NULL,
    expiry_date DATE,
    renewal_date DATE,
    certificate_number VARCHAR(100),
    certificate_url TEXT,
    verification_status VARCHAR(20) CHECK (verification_status IN ('valid', 'expired', 'revoked', 'pending_verification')),
    last_verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked', 'pending_renewal')),
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0103_certifications_employee ON ca0103_certifications(employee_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_certifications_type ON ca0103_certifications(certification_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_certifications_expiry ON ca0103_certifications(expiry_date) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_certifications_status ON ca0103_certifications(status) WHERE is_deleted = FALSE;

-- ========================================
-- CA0103_Violations: Training and certification violations
-- ========================================
CREATE TABLE IF NOT EXISTS ca0103_violations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    violation_type VARCHAR(50) NOT NULL CHECK (violation_type IN ('attendance', 'conduct', 'certification', 'safety', 'policy', 'other')),
    description TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('minor', 'major', 'critical')),
    incident_date DATE NOT NULL,
    reported_by UUID REFERENCES users(id),
    investigation_status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (investigation_status IN ('open', 'investigating', 'resolved', 'closed', 'appeal')),
    resolution_notes TEXT,
    corrective_action TEXT,
    disciplinary_action VARCHAR(100),
    suspension_start_date DATE,
    suspension_end_date DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0103_violations_employee ON ca0103_violations(employee_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_violations_type ON ca0103_violations(violation_type) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_violations_severity ON ca0103_violations(severity) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0103_violations_status ON ca0103_violations(investigation_status) WHERE is_deleted = FALSE;

-- ========================================
-- Trigger for updated_at on all CA0103 tables
-- ========================================
CREATE OR REPLACE FUNCTION update_ca0103_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0103_training_updated
    BEFORE UPDATE ON ca0103_training
    FOR EACH ROW EXECUTE FUNCTION update_ca0103_timestamp();

CREATE TRIGGER trg_ca0103_exams_updated
    BEFORE UPDATE ON ca0103_exams
    FOR EACH ROW EXECUTE FUNCTION update_ca0103_timestamp();

CREATE TRIGGER trg_ca0103_certifications_updated
    BEFORE UPDATE ON ca0103_certifications
    FOR EACH ROW EXECUTE FUNCTION update_ca0103_timestamp();

CREATE TRIGGER trg_ca0103_violations_updated
    BEFORE UPDATE ON ca0103_violations
    FOR EACH ROW EXECUTE FUNCTION update_ca0103_timestamp();

-- ========================================
-- Comment for documentation
-- ========================================
COMMENT ON TABLE ca0103_training IS 'Training sessions and completion records for employees in GXP environments';
COMMENT ON TABLE ca0103_exams IS 'Examination and evaluation records for training certification';
COMMENT ON TABLE ca0103_certifications IS 'Active certifications and qualifications held by employees';
COMMENT ON TABLE ca0103_violations IS 'Training and certification violations and disciplinary records';

COMMIT;