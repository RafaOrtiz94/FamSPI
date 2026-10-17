-- Migration: CA-01-07 (Quejas y Reclamos) - Phase 1: Persistence
-- Author: Kilo Agent

BEGIN;

CREATE TABLE IF NOT EXISTS ca0107_intake_form (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_type VARCHAR(50) NOT NULL CHECK (complaint_type IN ('quality', 'service', 'delivery', 'billing', 'other')),
    subject VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    reporter_name VARCHAR(255),
    reporter_email VARCHAR(255),
    reporter_phone VARCHAR(50),
    order_id UUID,
    product_id UUID,
    priority VARCHAR(20) CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    status VARCHAR(30) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'investigating', 'resolved', 'closed')),
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0107_investigation (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES ca0107_intake_form(id) ON DELETE CASCADE,
    investigator_id UUID NOT NULL,
    findings TEXT,
    root_cause TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed')),
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0107_refunds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES ca0107_intake_form(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    refund_type VARCHAR(30) CHECK (refund_type IN ('full', 'partial', 'credit', 'replacement')),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'processed', 'rejected')),
    approved_by UUID,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS ca0107_capa_link (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    complaint_id UUID REFERENCES ca0107_intake_form(id) ON DELETE CASCADE,
    capa_id UUID,
    description TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'linked', 'completed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX idx_ca0107_intake_status ON ca0107_intake_form(status) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0107_intake_type ON ca0107_intake_form(complaint_type) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0107_investigation_complaint ON ca0107_investigation(complaint_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0107_refunds_complaint ON ca0107_refunds(complaint_id) WHERE is_deleted = FALSE;
CREATE INDEX idx_ca0107_capa_complaint ON ca0107_capa_link(complaint_id) WHERE is_deleted = FALSE;

CREATE OR REPLACE FUNCTION update_ca0107_timestamp() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0107_intake_updated BEFORE UPDATE ON ca0107_intake_form FOR EACH ROW EXECUTE FUNCTION update_ca0107_timestamp();
CREATE TRIGGER trg_ca0107_investigation_updated BEFORE UPDATE ON ca0107_investigation FOR EACH ROW EXECUTE FUNCTION update_ca0107_timestamp();
CREATE TRIGGER trg_ca0107_refunds_updated BEFORE UPDATE ON ca0107_refunds FOR EACH ROW EXECUTE FUNCTION update_ca0107_timestamp();
CREATE TRIGGER trg_ca0107_capa_updated BEFORE UPDATE ON ca0107_capa_link FOR EACH ROW EXECUTE FUNCTION update_ca0107_timestamp();

COMMENT ON TABLE ca0107_intake_form IS 'Intake form for complaints and claims';
COMMENT ON TABLE ca0107_investigation IS 'Investigation records for complaints';
COMMENT ON TABLE ca0107_refunds IS 'Refund processing records';
COMMENT ON TABLE ca0107_capa_link IS 'Link to CAPA system';

COMMIT;