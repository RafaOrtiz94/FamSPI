-- CA-01-17: Tecnovigilancia
-- Migration: 146_ca0117_tecnovigilancia.sql

CREATE TABLE IF NOT EXISTS ca0117_vigilance_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_number VARCHAR(50) NOT NULL UNIQUE,
    device_name VARCHAR(255) NOT NULL,
    device_model VARCHAR(100),
    serial_number VARCHAR(100),
    incident_type VARCHAR(30) NOT NULL CHECK (incident_type IN ('malfunction', 'adverse_event', 'near_miss', 'recall', 'other')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'moderate', 'serious', 'critical')),
    description TEXT,
    status VARCHAR(20) DEFAULT 'reported' CHECK (status IN ('reported', 'investigating', 'resolved', 'closed')),
    reported_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0117_investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES ca0117_vigilance_reports(id),
    investigator_id UUID REFERENCES users(id),
    investigation_date DATE,
    findings TEXT,
    root_cause TEXT,
    conclusion TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0117_corrective_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES ca0117_investigations(id),
    action_description TEXT NOT NULL,
    responsible_id UUID REFERENCES users(id),
    target_date DATE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'verified')),
    completed_date DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0117_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES ca0117_vigilance_reports(id),
    authority_name VARCHAR(100),
    notification_date DATE,
    notification_ref VARCHAR(100),
    response TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0117_health_authority (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES ca0117_vigilance_reports(id),
    report_type VARCHAR(30) NOT NULL CHECK (report_type IN ('initial', 'followup', 'final')),
    submitted_date DATE,
    acknowledgment_ref VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);