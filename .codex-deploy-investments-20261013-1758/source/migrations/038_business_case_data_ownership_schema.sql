-- Business Case Data Ownership Schema
-- Tracks section completion and ownership for audit and informational purposes

-- Main ownership table
CREATE TABLE IF NOT EXISTS business_case_section_ownership (
    id SERIAL PRIMARY KEY,
    business_case_id UUID NOT NULL REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
    section_name VARCHAR(50) NOT NULL,

    -- Current completion info
    completed_by UUID,
    completed_by_role VARCHAR(50),
    completed_at TIMESTAMP WITH TIME ZONE,
    canonical_state VARCHAR(50),

    -- Audit trail
    first_completed_by UUID,
    first_completed_at TIMESTAMP WITH TIME ZONE,
    completion_count INTEGER DEFAULT 0,

    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    UNIQUE(business_case_id, section_name)
);

-- Ownership audit trail
CREATE TABLE IF NOT EXISTS business_case_section_ownership_audit (
    id SERIAL PRIMARY KEY,
    business_case_id UUID NOT NULL REFERENCES equipment_purchase_requests(id) ON DELETE CASCADE,
    section_name VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'completed', 'corrected', 'locked', etc.
    performed_by UUID NOT NULL,
    performed_by_role VARCHAR(50),
    canonical_state VARCHAR(50),
    metadata JSONB DEFAULT '{}',
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_bc_section_ownership_bc_id ON business_case_section_ownership(business_case_id);
CREATE INDEX IF NOT EXISTS idx_bc_section_ownership_section ON business_case_section_ownership(section_name);
CREATE INDEX IF NOT EXISTS idx_bc_section_ownership_completed_by ON business_case_section_ownership(completed_by);

CREATE INDEX IF NOT EXISTS idx_bc_section_ownership_audit_bc_id ON business_case_section_ownership_audit(business_case_id);
CREATE INDEX IF NOT EXISTS idx_bc_section_ownership_audit_section ON business_case_section_ownership_audit(section_name);
CREATE INDEX IF NOT EXISTS idx_bc_section_ownership_audit_performed_by ON business_case_section_ownership_audit(performed_by);
CREATE INDEX IF NOT EXISTS idx_bc_section_ownership_audit_performed_at ON business_case_section_ownership_audit(performed_at);

-- Comments
COMMENT ON TABLE business_case_section_ownership IS 'Tracks who completed each section of a business case and when';
COMMENT ON TABLE business_case_section_ownership_audit IS 'Audit trail for all section ownership changes';

COMMENT ON COLUMN business_case_section_ownership.business_case_id IS 'Reference to the business case';
COMMENT ON COLUMN business_case_section_ownership.section_name IS 'Name of the section (general, equipment, etc.)';
COMMENT ON COLUMN business_case_section_ownership.completed_by IS 'User who last completed this section';
COMMENT ON COLUMN business_case_section_ownership.completed_by_role IS 'Role of the user who last completed this section';
COMMENT ON COLUMN business_case_section_ownership.completed_at IS 'When this section was last completed';
COMMENT ON COLUMN business_case_section_ownership.canonical_state IS 'Business case state when section was completed';
COMMENT ON COLUMN business_case_section_ownership.first_completed_by IS 'User who first completed this section';
COMMENT ON COLUMN business_case_section_ownership.first_completed_at IS 'When this section was first completed';
COMMENT ON COLUMN business_case_section_ownership.completion_count IS 'How many times this section has been completed/modified';

COMMENT ON COLUMN business_case_section_ownership_audit.action IS 'Type of action performed (completed, corrected, locked)';
COMMENT ON COLUMN business_case_section_ownership_audit.performed_by IS 'User who performed the action';
COMMENT ON COLUMN business_case_section_ownership_audit.performed_by_role IS 'Role of the user who performed the action';
COMMENT ON COLUMN business_case_section_ownership_audit.canonical_state IS 'Business case state when action was performed';
