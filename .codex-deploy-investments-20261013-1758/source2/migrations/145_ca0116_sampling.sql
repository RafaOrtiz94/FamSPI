-- CA-01-16: Muestreo y Aprobación de Mercadería
-- Migration: 145_ca0116_sampling.sql

CREATE TABLE IF NOT EXISTS ca0116_sampling_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_number VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(255) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    unit VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'sampling' CHECK (status IN ('sampling', 'analyzing', 'approved', 'rejected', 'released')),
    sample_date DATE,
    analysis_date DATE,
    result VARCHAR(20),
    specification_ref VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0116_analysis_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES ca0116_sampling_batches(id),
    parameter VARCHAR(100) NOT NULL,
    result_value DECIMAL(10,2),
    specification_min DECIMAL(10,2),
    specification_max DECIMAL(10,2),
    unit VARCHAR(20),
    conforms BOOLEAN DEFAULT TRUE,
    method_ref VARCHAR(100),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0116_approvals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES ca0116_sampling_batches(id),
    approver_id UUID REFERENCES users(id),
    approval_status VARCHAR(20) DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected', 'conditional')),
    approval_date TIMESTAMP WITH TIME ZONE,
    conditions TEXT,
    notes TEXT,
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0116_releases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES ca0116_sampling_batches(id),
    release_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    released_by UUID REFERENCES users(id),
    destination VARCHAR(255),
    quantity_released DECIMAL(10,2),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ca0116_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES ca0116_sampling_batches(id),
    certificate_number VARCHAR(50) NOT NULL,
    certificate_url VARCHAR(500),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);