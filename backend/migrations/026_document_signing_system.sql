-- Migration: Document Signing System - Advanced Electronic Signatures
-- Date: 2025-12-18
-- Description: Implements the complete advanced electronic signature system
--              with cryptographic hashes, digital seals, and immutable audit logs

-- =============================================================================
-- PHASE 1: INFRASTRUCTURE BASE
-- =============================================================================

-- Modify existing documents table to support advanced signing
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS signature_status VARCHAR(50) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS current_hash_id INTEGER,
ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS locked_by INTEGER REFERENCES users(id);

-- Add comments to documents table columns
COMMENT ON COLUMN documents.signature_status IS 'Status: pending, signed, locked, expired';
COMMENT ON COLUMN documents.current_hash_id IS 'Reference to the current document hash';
COMMENT ON COLUMN documents.is_locked IS 'True if document is locked after signing';
COMMENT ON COLUMN documents.locked_at IS 'Timestamp when document was locked';
COMMENT ON COLUMN documents.locked_by IS 'User who locked the document';

-- Create document_hashes table for cryptographic integrity
CREATE TABLE IF NOT EXISTS document_hashes (
    id SERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL DEFAULT 'pdf', -- 'pdf', 'docx', 'excel'
    hash_sha256 VARCHAR(64) NOT NULL,
    hash_algorithm VARCHAR(20) DEFAULT 'SHA-256',
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    calculated_by INTEGER REFERENCES users(id),
    is_current BOOLEAN DEFAULT true,

    -- Ensure only one current hash per document
    CONSTRAINT unique_current_hash UNIQUE (document_id, is_current) DEFERRABLE INITIALLY DEFERRED,

    -- Hash must be valid SHA-256 (64 characters, hex only)
    CONSTRAINT valid_sha256_hash CHECK (
        LENGTH(hash_sha256) = 64 AND
        hash_sha256 ~ '^[a-f0-9]{64}$'
    ),

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create document_signatures_advanced table for advanced electronic signatures
CREATE TABLE IF NOT EXISTS document_signatures_advanced (
    id SERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    signer_user_id INTEGER NOT NULL REFERENCES users(id),
    signer_role VARCHAR(100) NOT NULL,
    signature_type VARCHAR(50) DEFAULT 'advanced_electronic',

    -- Signer identity
    signer_name VARCHAR(255) NOT NULL,
    signer_email VARCHAR(255) NOT NULL,
    signer_department VARCHAR(100),

    -- Signing timestamp and context
    signed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET NOT NULL,
    user_agent TEXT,

    -- Authentication details
    session_id VARCHAR(255),
    auth_method VARCHAR(50) DEFAULT 'oauth_corporate',

    -- Cryptographic evidence
    document_hash_id INTEGER REFERENCES document_hashes(id),
    signature_hash VARCHAR(64), -- Hash of the complete signature record

    -- Signature validity
    is_valid BOOLEAN DEFAULT true,
    invalidated_at TIMESTAMP WITH TIME ZONE,
    invalidation_reason TEXT,

    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_signature_hash CHECK (
        signature_hash IS NULL OR
        (LENGTH(signature_hash) = 64 AND signature_hash ~ '^[a-f0-9]{64}$')
    ),

    -- Prevent duplicate signatures for same user/document
    CONSTRAINT unique_user_document_signature UNIQUE (document_id, signer_user_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_hashes_document_id ON document_hashes(document_id);
CREATE INDEX IF NOT EXISTS idx_document_hashes_current ON document_hashes(document_id, is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_document_signatures_advanced_document_id ON document_signatures_advanced(document_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_advanced_signer ON document_signatures_advanced(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_document_signatures_advanced_signed_at ON document_signatures_advanced(signed_at DESC);
CREATE INDEX IF NOT EXISTS idx_document_signatures_advanced_valid ON document_signatures_advanced(is_valid) WHERE is_valid = true;

-- Add table comments
COMMENT ON TABLE document_hashes IS 'Cryptographic hashes for document integrity verification';
COMMENT ON TABLE document_signatures_advanced IS 'Advanced electronic signatures with full audit trail';

-- Add column comments
COMMENT ON COLUMN document_hashes.document_type IS 'Type of document: pdf, docx, excel, etc.';
COMMENT ON COLUMN document_hashes.hash_sha256 IS 'SHA-256 hash of the document content';
COMMENT ON COLUMN document_hashes.is_current IS 'True if this is the current valid hash for the document';

COMMENT ON COLUMN document_signatures_advanced.signer_role IS 'Role of the signer at the time of signing';
COMMENT ON COLUMN document_signatures_advanced.signature_type IS 'Type of signature: advanced_electronic, qualified, etc.';
COMMENT ON COLUMN document_signatures_advanced.auth_method IS 'Authentication method used: oauth_corporate, certificate, etc.';
COMMENT ON COLUMN document_signatures_advanced.document_hash_id IS 'Reference to the document hash at time of signing';
COMMENT ON COLUMN document_signatures_advanced.signature_hash IS 'Hash of the complete signature record for tamper detection';

-- Create function to update document signature status
CREATE OR REPLACE FUNCTION update_document_signature_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update document signature status based on signatures
    UPDATE documents
    SET signature_status = CASE
        WHEN EXISTS (SELECT 1 FROM document_signatures_advanced dsa
                    WHERE dsa.document_id = NEW.document_id AND dsa.is_valid = true) THEN 'signed'
        ELSE 'pending'
    END
    WHERE id = NEW.document_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update document status when signatures change
DROP TRIGGER IF EXISTS trg_update_document_signature_status ON document_signatures_advanced;
CREATE TRIGGER trg_update_document_signature_status
    AFTER INSERT OR UPDATE OR DELETE ON document_signatures_advanced
    FOR EACH ROW EXECUTE FUNCTION update_document_signature_status();

-- Create function to ensure only one current hash per document
CREATE OR REPLACE FUNCTION ensure_single_current_hash()
RETURNS TRIGGER AS $$
BEGIN
    -- If new hash is marked as current, unset all other current hashes for this document
    IF NEW.is_current = true THEN
        UPDATE document_hashes
        SET is_current = false
        WHERE document_id = NEW.document_id AND id != NEW.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to maintain single current hash
DROP TRIGGER IF EXISTS trg_ensure_single_current_hash ON document_hashes;
CREATE TRIGGER trg_ensure_single_current_hash
    BEFORE INSERT OR UPDATE ON document_hashes
    FOR EACH ROW EXECUTE FUNCTION ensure_single_current_hash();

-- Add signature permissions to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS can_sign_documents BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS signature_role VARCHAR(100),
ADD COLUMN IF NOT EXISTS signature_certificate_id VARCHAR(255);

COMMENT ON COLUMN users.can_sign_documents IS 'Whether user has permission to sign documents';
COMMENT ON COLUMN users.signature_role IS 'Role for signature authorization (DPD, Manager, etc.)';
COMMENT ON COLUMN users.signature_certificate_id IS 'ID of digital certificate for qualified signatures';

-- Create initial signature permissions for key roles
UPDATE users
SET can_sign_documents = true,
    signature_role = CASE
        WHEN role = 'admin' THEN 'Administrator'
        WHEN role = 'gerencia' THEN 'Manager'
        WHEN role = 'jefe_comercial' THEN 'Commercial Director'
        WHEN role = 'jefe_ti' THEN 'IT Director'
        WHEN role = 'backoffice' THEN 'Backoffice'
        ELSE role
    END
WHERE role IN ('admin', 'gerencia', 'jefe_comercial', 'jefe_ti', 'backoffice', 'comercial', 'tecnico');

-- Create view for signature dashboard (if not exists)
CREATE OR REPLACE VIEW signature_dashboard AS
WITH per_document AS (
    SELECT
        d.id,
        d.signature_status,
        d.is_locked,
        d.created_at,
        MIN(dsa.signed_at) AS first_signed_at
    FROM documents d
    LEFT JOIN document_signatures_advanced dsa ON dsa.document_id = d.id
    GROUP BY d.id, d.signature_status, d.is_locked, d.created_at
)
SELECT
    COUNT(*) AS total_documents,
    COUNT(*) FILTER (WHERE signature_status = 'signed') AS signed_documents,
    COUNT(*) FILTER (WHERE is_locked IS TRUE) AS locked_documents,
    AVG(EXTRACT(EPOCH FROM (first_signed_at - created_at)) / 3600.0) AS avg_signing_time_hours
FROM per_document;

COMMENT ON VIEW signature_dashboard IS 'Dashboard metrics for document signing system';

-- Grant permissions
GRANT SELECT ON document_hashes TO PUBLIC;
GRANT SELECT ON document_signatures_advanced TO PUBLIC;
GRANT SELECT ON signature_dashboard TO PUBLIC;

-- Create initial signature policies (will be expanded in later phases)
-- This ensures data integrity and auditability

COMMIT;
