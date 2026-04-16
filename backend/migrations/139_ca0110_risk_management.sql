-- Migration: CA-01-10 (Gestión de Riesgos) - Phase 1: Persistence
-- Author: Kilo Agent

BEGIN;

CREATE TABLE IF NOT EXISTS ca0110_fmea_matrix (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    process_name VARCHAR(255) NOT NULL,
    failure_mode VARCHAR(255) NOT NULL,
    severity_score INTEGER CHECK (severity_score BETWEEN 1 AND 10),
    occurrence_score INTEGER CHECK (occurrence_score BETWEEN 1 AND 10),
    detection_score INTEGER CHECK (detection_score BETWEEN 1 AND 10),
    rpn INTEGER GENERATED ALWAYS AS (severity_score * occurrence_score * detection_score) STORED,
    risk_level VARCHAR(20) CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'mitigated', 'closed')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0110_mitigation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fmea_id UUID REFERENCES ca0110_fmea_matrix(id) ON DELETE CASCADE,
    mitigation_action TEXT NOT NULL,
    responsible_id UUID NOT NULL,
    target_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    completed_at TIMESTAMPTZ,
    effectiveness VARCHAR(20),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0110_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    review_type VARCHAR(50) CHECK (review_type IN ('quarterly', 'annual', 'ad_hoc', 'incident')),
    review_date DATE NOT NULL,
    participants JSONB,
    conclusions TEXT,
    action_items JSONB,
    status VARCHAR(30) NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'completed', 'cancelled')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0110_impact_assessment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    risk_id UUID REFERENCES ca0110_fmea_matrix(id) ON DELETE CASCADE,
    impact_type VARCHAR(50) CHECK (impact_type IN ('financial', 'operational', 'regulatory', 'reputational', 'safety')),
    description TEXT NOT NULL,
    probability INTEGER CHECK (probability BETWEEN 1 AND 5),
    impact_score INTEGER CHECK (impact_score BETWEEN 1 AND 5),
    overall_risk INTEGER GENERATED ALWAYS AS (probability * impact_score) STORED,
    mitigation_plan TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'implemented', 'closed')),
    assessed_by UUID,
    assessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_ca0110_fmea_rpn ON ca0110_fmea_matrix(rpn) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0110_fmea_risk ON ca0110_fmea_matrix(risk_level) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0110_mitigation_fmea ON ca0110_mitigation(fmea_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0110_reviews_type ON ca0110_reviews(review_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0110_impact_risk ON ca0110_impact_assessment(risk_id) WHERE is_deleted = FALSE;

CREATE OR REPLACE FUNCTION update_ca0110_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0110_fmea_updated BEFORE UPDATE ON ca0110_fmea_matrix FOR EACH ROW EXECUTE FUNCTION update_ca0110_timestamp();
CREATE TRIGGER trg_ca0110_mitigation_updated BEFORE UPDATE ON ca0110_mitigation FOR EACH ROW EXECUTE FUNCTION update_ca0110_timestamp();
CREATE TRIGGER trg_ca0110_reviews_updated BEFORE UPDATE ON ca0110_reviews FOR EACH ROW EXECUTE FUNCTION update_ca0110_timestamp();
CREATE TRIGGER trg_ca0110_impact_updated BEFORE UPDATE ON ca0110_impact_assessment FOR EACH ROW EXECUTE FUNCTION update_ca0110_timestamp();

COMMENT ON TABLE ca0110_fmea_matrix IS 'FMEA risk matrix records';
COMMENT ON TABLE ca0110_mitigation IS 'Risk mitigation actions';
COMMENT ON TABLE ca0110_reviews IS 'Risk management reviews';
COMMENT ON TABLE ca0110_impact_assessment IS 'Impact assessments';

COMMIT;