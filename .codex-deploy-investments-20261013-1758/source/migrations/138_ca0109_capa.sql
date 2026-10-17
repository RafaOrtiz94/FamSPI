-- Migration: CA-01-09 (CAPA - Acciones Correctivas) - Phase 1: Persistence
-- Author: Kilo Agent

BEGIN;

CREATE TABLE IF NOT EXISTS ca0109_rca (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_type VARCHAR(50) CHECK (source_type IN ('audit', 'complaint', 'deviation', 'inspection', 'other')),
    source_id UUID,
    description TEXT NOT NULL,
    severity VARCHAR(20) CHECK (severity IN ('minor', 'major', 'critical')),
    root_cause TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'action_plan', 'in_progress', 'completed', 'closed')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0109_action_plan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID REFERENCES ca0109_rca(id) ON DELETE CASCADE,
    action_description TEXT NOT NULL,
    responsible_id UUID NOT NULL,
    due_date DATE NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'overdue')),
    completed_at TIMESTAMPTZ,
    effectiveness TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0109_escalation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rca_id UUID REFERENCES ca0109_rca(id) ON DELETE CASCADE,
    escalation_level VARCHAR(20) CHECK (escalation_level IN ('level1', 'level2', 'level3', 'executive')),
    reason TEXT NOT NULL,
    escalated_to UUID,
    escalated_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'rejected')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0109_effectiveness (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_plan_id UUID REFERENCES ca0109_action_plan(id) ON DELETE CASCADE,
    evaluation_date DATE NOT NULL,
    effectiveness_score VARCHAR(20) CHECK (effectiveness_score IN ('effective', 'partially_effective', 'ineffective')),
    evaluation_notes TEXT,
    follow_up_required BOOLEAN DEFAULT FALSE,
    follow_up_date DATE,
    evaluated_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_ca0109_rca_status ON ca0109_rca(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0109_rca_severity ON ca0109_rca(severity) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0109_action_rca ON ca0109_action_plan(rca_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0109_escalation_rca ON ca0109_escalation(rca_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0109_effectiveness_action ON ca0109_effectiveness(action_plan_id) WHERE is_deleted = FALSE;

CREATE OR REPLACE FUNCTION update_ca0109_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0109_rca_updated BEFORE UPDATE ON ca0109_rca FOR EACH ROW EXECUTE FUNCTION update_ca0109_timestamp();
CREATE TRIGGER trg_ca0109_action_updated BEFORE UPDATE ON ca0109_action_plan FOR EACH ROW EXECUTE FUNCTION update_ca0109_timestamp();
CREATE TRIGGER trg_ca0109_escalation_updated BEFORE UPDATE ON ca0109_escalation FOR EACH ROW EXECUTE FUNCTION update_ca0109_timestamp();
CREATE TRIGGER trg_ca0109_effectiveness_updated BEFORE UPDATE ON ca0109_effectiveness FOR EACH ROW EXECUTE FUNCTION update_ca0109_timestamp();

COMMENT ON TABLE ca0109_rca IS 'Root cause analysis records';
COMMENT ON TABLE ca0109_action_plan IS 'Corrective action plans';
COMMENT ON TABLE ca0109_escalation IS 'Escalation records';
COMMENT ON TABLE ca0109_effectiveness IS 'Effectiveness evaluations';

COMMIT;