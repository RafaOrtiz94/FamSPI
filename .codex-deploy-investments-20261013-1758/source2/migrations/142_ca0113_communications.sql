-- CA-01-13: Comunicación Interna/terna
-- Migration: 142_ca0113_communications.sql

-- Tabla principal de comunicaciones
CREATE TABLE IF NOT EXISTS ca0113_communications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_type VARCHAR(50) NOT NULL CHECK (communication_type IN ('internal', 'external', 'emergency', 'regulatory', 'general')),
    title VARCHAR(255) NOT NULL,
    content TEXT,
    priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'published', 'archived')),
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'portal', 'sms', 'whatsapp', 'physical', 'all')),
    target_audience VARCHAR(100),
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    published_at TIMESTAMP WITH TIME ZONE,
    expiration_date DATE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0113_communications_type ON ca0113_communications(communication_type);
CREATE INDEX IF NOT EXISTS idx_ca0113_communications_status ON ca0113_communications(status);
CREATE INDEX IF NOT EXISTS idx_ca0113_communications_priority ON ca0113_communications(priority);

-- Tabla de destinatarios
CREATE TABLE IF NOT EXISTS ca0113_recipients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES ca0113_communications(id),
    recipient_type VARCHAR(20) NOT NULL CHECK (recipient_type IN ('user', 'role', 'department', 'all')),
    recipient_id VARCHAR(255),
    received_at TIMESTAMP WITH TIME ZONE,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0113_recipients_communication ON ca0113_recipients(communication_id);

-- Tabla de archivos adjuntos
CREATE TABLE IF NOT EXISTS ca0113_attachments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES ca0113_communications(id),
    file_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_type VARCHAR(50),
    file_size INTEGER,
    uploaded_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0113_attachments_communication ON ca0113_attachments(communication_id);

-- Tabla de logs de lectura
CREATE TABLE IF NOT EXISTS ca0113_read_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    communication_id UUID NOT NULL REFERENCES ca0113_communications(id),
    user_id UUID REFERENCES users(id),
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0113_read_logs_communication ON ca0113_read_logs(communication_id);
CREATE INDEX IF NOT EXISTS idx_ca0113_read_logs_user ON ca0113_read_logs(user_id);

-- Tabla de templates de comunicación
CREATE TABLE IF NOT EXISTS ca0113_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_name VARCHAR(100) NOT NULL,
    template_type VARCHAR(50) NOT NULL CHECK (template_type IN ('internal', 'external', 'emergency', 'regulatory')),
    subject_template VARCHAR(255),
    body_template TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ca0113_templates_type ON ca0113_templates(template_type);