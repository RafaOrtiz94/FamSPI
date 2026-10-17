-- CA-01-15: Auditorías Internas/Externas
-- Migration: 144_ca0115_audits.sql

-- Tabla principal de auditorías
CREATE TABLE IF NOT EXISTS ca0115_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_number VARCHAR(50) NOT NULL UNIQUE,
    audit_type VARCHAR(20) NOT NULL CHECK (audit_type IN ('internal', 'external', 'regulatory', 'supplier')),
    scope VARCHAR(255) NOT NULL,
    standard VARCHAR(50) NOT NULL CHECK (standard IN ('iso_9001', 'iso_14001', 'gmp', 'gdp', 'gqp', 'other')),
    status VARCHAR(20) NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'in_progress', 'completed', 'closed', 'cancelled')),
    planned_start_date DATE,
    actual_start_date DATE,
    planned_end_date DATE,
    actual_end_date DATE,
    lead_auditor_id UUID REFERENCES users(id),
    team_members JSONB,
    result VARCHAR(20),
    findings_count INTEGER DEFAULT 0,
    critical_findings INTEGER DEFAULT 0,
    major_findings INTEGER DEFAULT 0,
    minor_findings INTEGER DEFAULT 0,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0115_audits_type ON ca0115_audits(audit_type);
CREATE INDEX IF NOT EXISTS idx_ca0115_audits_status ON ca0115_audits(status);
CREATE INDEX IF NOT EXISTS idx_ca0115_audits_dates ON ca0115_audits(planned_start_date);

-- Tabla de hallazgos de auditoría
CREATE TABLE IF NOT EXISTS ca0115_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES ca0115_audits(id),
    finding_number VARCHAR(20) NOT NULL,
    finding_type VARCHAR(20) NOT NULL CHECK (finding_type IN ('critical', 'major', 'minor', 'observation', 'opportunity')),
    description TEXT NOT NULL,
    area_affected VARCHAR(255),
    clause_reference VARCHAR(50),
    root_cause TEXT,
    corrective_action TEXT,
    due_date DATE,
    verification_date DATE,
    verified_by UUID REFERENCES users(id),
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'closed', 'verified')),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0115_findings_audit ON ca0115_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_ca0115_findings_status ON ca0115_findings(status);

-- Tabla de evidencia
CREATE TABLE IF NOT EXISTS ca0115_evidences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES ca0115_audits(id),
    finding_id UUID REFERENCES ca0115_findings(id),
    evidence_type VARCHAR(30) NOT NULL CHECK (evidence_type IN ('document', 'photo', 'record', 'interview', 'observation')),
    description TEXT,
    file_url VARCHAR(500),
    uploaded_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0115_evidences_audit ON ca0115_evidences(audit_id);

-- Tabla de checklists de auditoría
CREATE TABLE IF NOT EXISTS ca0115_checklists (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES ca0115_audits(id),
    clause_code VARCHAR(30) NOT NULL,
    question_text TEXT NOT NULL,
    response VARCHAR(20) CHECK (response IN ('compliant', 'non_compliant', 'na', 'pending')),
    evidence_ref VARCHAR(255),
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0115_checklists_audit ON ca0115_checklists(audit_id);

-- Tabla de seguimiento de auditorías
CREATE TABLE IF NOT EXISTS ca0115_follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    audit_id UUID NOT NULL REFERENCES ca0115_audits(id),
    finding_id UUID REFERENCES ca0115_findings(id),
    follow_up_date DATE NOT NULL,
    description TEXT NOT NULL,
    result VARCHAR(20) CHECK (result IN ('effective', 'partially_effective', 'ineffective')),
    next_action TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0115_followups_audit ON ca0115_follow_ups(audit_id);