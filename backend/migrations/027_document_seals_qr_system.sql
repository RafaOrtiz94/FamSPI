-- Migration: Document Seals and QR System - Phase 2
-- Date: 2025-12-18
-- Description: Implements institutional seals and QR verification codes
--              for advanced electronic signatures

-- =============================================================================
-- PHASE 2: SELLOS DIGITALES INSTITUCIONALES Y QR CODES
-- =============================================================================

-- Create document_seals table for institutional digital seals
CREATE TABLE IF NOT EXISTS document_seals (
    id SERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    seal_code VARCHAR(50) UNIQUE NOT NULL, -- SPI-2025-RESP-00421
    seal_type VARCHAR(50) DEFAULT 'institutional',

    -- Emisor (Issuer)
    issued_by VARCHAR(255) DEFAULT 'SPI Fam',
    authorized_role VARCHAR(100) NOT NULL,
    authorized_user_id INTEGER REFERENCES users(id),

    -- Token único para verificación
    seal_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
    document_hash_id INTEGER REFERENCES document_hashes(id),

    -- Vigencia del sello
    issued_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,

    -- Metadata adicional
    seal_metadata JSONB DEFAULT '{}'::jsonb,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_seal_code CHECK (
        seal_code ~ '^SPI-\d{4}-[A-Z]+-\d{5}$'
    ),
    CONSTRAINT seal_expiration_check CHECK (
        expires_at IS NULL OR expires_at > issued_at
    )
);

-- Create document_qr_codes table for verification QR codes
CREATE TABLE IF NOT EXISTS document_qr_codes (
    id SERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    seal_id INTEGER REFERENCES document_seals(id),

    -- QR Code data
    qr_code TEXT NOT NULL, -- Base64 encoded QR image
    qr_url TEXT NOT NULL, -- Public verification URL
    verification_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,

    -- Generation metadata
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,

    -- Access tracking
    access_count INTEGER DEFAULT 0,
    first_accessed_at TIMESTAMP WITH TIME ZONE,
    last_accessed_at TIMESTAMP WITH TIME ZONE,

    -- QR configuration
    qr_size INTEGER DEFAULT 256, -- QR code size in pixels
    qr_format VARCHAR(10) DEFAULT 'png',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Constraints
    CONSTRAINT valid_qr_size CHECK (qr_size BETWEEN 128 AND 1024),
    CONSTRAINT valid_qr_format CHECK (qr_format IN ('png', 'svg', 'jpg'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_document_seals_document_id ON document_seals(document_id);
CREATE INDEX IF NOT EXISTS idx_document_seals_seal_code ON document_seals(seal_code);
CREATE INDEX IF NOT EXISTS idx_document_seals_token ON document_seals(seal_token);
CREATE INDEX IF NOT EXISTS idx_document_seals_active ON document_seals(is_active) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_document_qr_codes_document_id ON document_qr_codes(document_id);
CREATE INDEX IF NOT EXISTS idx_document_qr_codes_seal_id ON document_qr_codes(seal_id);
CREATE INDEX IF NOT EXISTS idx_document_qr_codes_token ON document_qr_codes(verification_token);
CREATE INDEX IF NOT EXISTS idx_document_qr_codes_active ON document_qr_codes(is_active) WHERE is_active = true;

-- Add table comments
COMMENT ON TABLE document_seals IS 'Institutional digital seals for document authentication';
COMMENT ON TABLE document_qr_codes IS 'QR codes for public document verification';

-- Add column comments
COMMENT ON COLUMN document_seals.seal_code IS 'Unique institutional seal code (format: SPI-YYYY-TYPE-NNNNN)';
COMMENT ON COLUMN document_seals.seal_token IS 'Unique token for seal verification and API access';
COMMENT ON COLUMN document_seals.authorized_role IS 'Role that authorized the seal (DPD, Manager, etc.)';

COMMENT ON COLUMN document_qr_codes.qr_code IS 'Base64 encoded QR code image';
COMMENT ON COLUMN document_qr_codes.qr_url IS 'Public URL for document verification';
COMMENT ON COLUMN document_qr_codes.verification_token IS 'Token for public verification endpoint';

-- Create function to generate seal codes
CREATE OR REPLACE FUNCTION generate_seal_code(
    p_document_id BIGINT,
    p_authorized_role VARCHAR(100)
) RETURNS VARCHAR(50) AS $$
DECLARE
    v_year TEXT;
    v_role_prefix TEXT;
    v_sequence INTEGER;
    v_seal_code VARCHAR(50);
BEGIN
    -- Get current year
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');

    -- Convert role to prefix
    v_role_prefix := CASE UPPER(p_authorized_role)
        WHEN 'DELEGADO DE PROTECCIÓN DE DATOS' THEN 'DPD'
        WHEN 'JEFE DE TI' THEN 'TI'
        WHEN 'GERENTE' THEN 'GER'
        WHEN 'JEFE COMERCIAL' THEN 'COM'
        WHEN 'BACKOFFICE' THEN 'BOF'
        WHEN 'TÉCNICO' THEN 'TEC'
        ELSE 'RESP'
    END;

    -- Get next sequence number (based on document_id for uniqueness)
    v_sequence := (p_document_id % 90000) + 10000; -- 10000-99999 range

    -- Generate seal code
    v_seal_code := 'SPI-' || v_year || '-' || v_role_prefix || '-' || LPAD(v_sequence::TEXT, 5, '0');

    RETURN v_seal_code;
END;
$$ LANGUAGE plpgsql;

-- Create function to generate QR verification URL
CREATE OR REPLACE FUNCTION generate_qr_url(p_verification_token UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN 'https://spi.famproject.app/verificar/' || p_verification_token::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Create function to update QR access tracking
CREATE OR REPLACE FUNCTION track_qr_access(p_qr_id INTEGER)
RETURNS VOID AS $$
BEGIN
    UPDATE document_qr_codes
    SET
        access_count = access_count + 1,
        first_accessed_at = COALESCE(first_accessed_at, NOW()),
        last_accessed_at = NOW()
    WHERE id = p_qr_id AND is_active = true;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate seal code
CREATE OR REPLACE FUNCTION generate_seal_code_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.seal_code IS NULL THEN
        NEW.seal_code := generate_seal_code(NEW.document_id, NEW.authorized_role);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_seal_code ON document_seals;
CREATE TRIGGER trg_generate_seal_code
    BEFORE INSERT ON document_seals
    FOR EACH ROW EXECUTE FUNCTION generate_seal_code_trigger();

-- Create trigger to automatically generate QR URL
CREATE OR REPLACE FUNCTION generate_qr_url_trigger()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.qr_url IS NULL THEN
        NEW.qr_url := generate_qr_url(NEW.verification_token);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_qr_url ON document_qr_codes;
CREATE TRIGGER trg_generate_qr_url
    BEFORE INSERT ON document_qr_codes
    FOR EACH ROW EXECUTE FUNCTION generate_qr_url_trigger();

-- Create function to create complete seal and QR package
CREATE OR REPLACE FUNCTION create_document_seal_and_qr(
    p_document_id BIGINT,
    p_authorized_role VARCHAR(100),
    p_authorized_user_id INTEGER DEFAULT NULL
) RETURNS TABLE(seal_id INTEGER, qr_id INTEGER) AS $$
DECLARE
    v_seal_id INTEGER;
    v_qr_id INTEGER;
BEGIN
    -- Create institutional seal
    INSERT INTO document_seals (
        document_id,
        authorized_role,
        authorized_user_id
    ) VALUES (
        p_document_id,
        p_authorized_role,
        p_authorized_user_id
    ) RETURNING id INTO v_seal_id;

    -- Create QR code for verification
    INSERT INTO document_qr_codes (
        document_id,
        seal_id
    ) VALUES (
        p_document_id,
        v_seal_id
    ) RETURNING id INTO v_qr_id;

    -- Return the created IDs
    RETURN QUERY SELECT v_seal_id, v_qr_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for seal and QR verification
CREATE OR REPLACE VIEW document_verification_info AS
SELECT
    d.id AS document_id,
    d.doc_drive_id,
    d.pdf_drive_id,
    d.signature_status,
    d.is_locked,

    -- Seal information
    ds.seal_code,
    ds.seal_token,
    ds.issued_by,
    ds.authorized_role,
    ds.issued_at,
    ds.is_active AS seal_active,

    -- QR information
    dqc.qr_url,
    dqc.verification_token,
    dqc.access_count,
    dqc.last_accessed_at,
    dqc.is_active AS qr_active,

    -- Hash information
    dh.hash_sha256,
    dh.calculated_at AS hash_calculated_at,

    -- Latest signature
    dsa.signed_at AS last_signed_at,
    dsa.signer_name AS last_signer_name,
    dsa.signer_role AS last_signer_role

FROM documents d
LEFT JOIN document_seals ds ON ds.document_id = d.id AND ds.is_active = true
LEFT JOIN document_qr_codes dqc ON dqc.document_id = d.id AND dqc.is_active = true
LEFT JOIN document_hashes dh ON dh.id = d.current_hash_id
LEFT JOIN document_signatures_advanced dsa ON dsa.document_id = d.id
    AND dsa.signed_at = (
        SELECT MAX(signed_at)
        FROM document_signatures_advanced
        WHERE document_id = d.id AND is_valid = true
    );

COMMENT ON VIEW document_verification_info IS 'Complete verification information for documents with seals and QR codes';

-- Grant permissions
GRANT SELECT ON document_seals TO PUBLIC;
GRANT SELECT ON document_qr_codes TO PUBLIC;
GRANT SELECT ON document_verification_info TO PUBLIC;

-- Create indexes for the verification view
CREATE INDEX IF NOT EXISTS idx_document_seals_verification ON document_seals(document_id, is_active, seal_token);
CREATE INDEX IF NOT EXISTS idx_document_qr_codes_verification ON document_qr_codes(document_id, is_active, verification_token);

COMMIT;
