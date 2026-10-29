-- Migration: CA-01-06 (Retiro del Mercado/Recall) - Phase 1: Persistence
-- Author: Kilo Agent
-- Description: Creates relational tables for Recall management with GXP audit support

BEGIN;

-- ========================================
-- CA0106_Traceability: Product lot traceability
-- ========================================
CREATE TABLE IF NOT EXISTS ca0106_traceability (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    lot_number VARCHAR(100) NOT NULL,
    manufacturing_date DATE,
    expiry_date DATE,
    quantity_total INTEGER NOT NULL DEFAULT 0,
    quantity_distributed INTEGER NOT NULL DEFAULT 0,
    quantity_remaining INTEGER NOT NULL DEFAULT 0,
    distribution_channels TEXT,
    affected_countries TEXT,
    status VARCHAR(30) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'quarantine', 'recalled', 'closed')),
    recall_level VARCHAR(20) CHECK (recall_level IN ('wholesale', 'retail', 'consumer', 'defect')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0106_traceability_lot ON ca0106_traceability(lot_number) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0106_traceability_status ON ca0106_traceability(status) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0106_traceability_product ON ca0106_traceability(product_id) WHERE is_deleted = FALSE;

-- ========================================
-- CA0106_Communication: Recall communications
-- ========================================
CREATE TABLE IF NOT EXISTS ca0106_communication (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recall_id UUID REFERENCES ca0106_traceability(id) ON DELETE CASCADE,
    communication_type VARCHAR(50) NOT NULL CHECK (communication_type IN ('press', 'direct', 'regulatory', 'internal')),
    subject VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    target_audience TEXT NOT NULL,
    sent_date TIMESTAMPTZ,
    channels VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'cancelled')),
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0106_communication_recall ON ca0106_communication(recall_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0106_communication_status ON ca0106_communication(status) WHERE is_deleted = FALSE;

-- ========================================
-- CA0106_Quarantine: Quarantine management
-- ========================================
CREATE TABLE IF NOT EXISTS ca0106_quarantine (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recall_id UUID REFERENCES ca0106_traceability(id) ON DELETE CASCADE,
    location_id UUID NOT NULL,
    location_name VARCHAR(255) NOT NULL,
    quantity_quarantined INTEGER NOT NULL DEFAULT 0,
    quarantine_reason TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'released', 'destroyed')),
    disposition_decision VARCHAR(50),
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0106_quarantine_recall ON ca0106_quarantine(recall_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0106_quarantine_status ON ca0106_quarantine(status) WHERE is_deleted = FALSE;

-- ========================================
-- CA0106_Logistics: Recall logistics tracking
-- ========================================
CREATE TABLE IF NOT EXISTS ca0106_logistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recall_id UUID REFERENCES ca0106_traceability(id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL CHECK (action_type IN ('pickup', 'return', 'destroy', 'replace', 'refund')),
    quantity INTEGER NOT NULL DEFAULT 0,
    destination VARCHAR(255),
    carrier VARCHAR(255),
    tracking_number VARCHAR(100),
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_ca0106_logistics_recall ON ca0106_logistics(recall_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_ca0106_logistics_status ON ca0106_logistics(status) WHERE is_deleted = FALSE;

-- ========================================
-- Trigger for updated_at on all CA0106 tables
-- ========================================
CREATE OR REPLACE FUNCTION update_ca0106_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ca0106_traceability_updated
    BEFORE UPDATE ON ca0106_traceability
    FOR EACH ROW EXECUTE FUNCTION update_ca0106_timestamp();

CREATE TRIGGER trg_ca0106_communication_updated
    BEFORE UPDATE ON ca0106_communication
    FOR EACH ROW EXECUTE FUNCTION update_ca0106_timestamp();

CREATE TRIGGER trg_ca0106_quarantine_updated
    BEFORE UPDATE ON ca0106_quarantine
    FOR EACH ROW EXECUTE FUNCTION update_ca0106_timestamp();

CREATE TRIGGER trg_ca0106_logistics_updated
    BEFORE UPDATE ON ca0106_logistics
    FOR EACH ROW EXECUTE FUNCTION update_ca0106_timestamp();

-- ========================================
-- Comment for documentation
-- ========================================
COMMENT ON TABLE ca0106_traceability IS 'Product lot traceability for recall management';
COMMENT ON TABLE ca0106_communication IS 'Recall communications and notifications';
COMMENT ON TABLE ca0106_quarantine IS 'Quarantine management for recalled products';
COMMENT ON TABLE ca0106_logistics IS 'Logistics tracking for recall actions';

COMMIT;