-- Migration: Document Audit Functions - Hash Chain System - Phase 3 Extended
-- Date: 2025-12-18
-- Description: Adds hash chain functions, triggers and views for immutable audit logs

-- =============================================================================
-- PHASE 3 EXTENDED: FUNCIONES DE CADENA DE HASH INMUTABLE
-- =============================================================================

-- Create function to generate event hash
CREATE OR REPLACE FUNCTION generate_event_hash(
    p_document_id BIGINT,
    p_event_type VARCHAR(100),
    p_event_timestamp TIMESTAMP WITH TIME ZONE,
    p_user_id INTEGER,
    p_event_data JSONB,
    p_previous_hash VARCHAR(64) DEFAULT NULL
) RETURNS VARCHAR(64) AS $$
DECLARE
    v_data TEXT;
BEGIN
    -- Create a consistent string representation of the event
    v_data := p_document_id::TEXT || '|' ||
              p_event_type || '|' ||
              p_event_timestamp::TEXT || '|' ||
              COALESCE(p_user_id::TEXT, '') || '|' ||
              p_event_data::TEXT || '|' ||
              COALESCE(p_previous_hash, '');

    -- Return SHA-256 hash
    RETURN encode(digest(v_data, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Create function to get next chain position for a document
CREATE OR REPLACE FUNCTION get_next_chain_position(p_document_id BIGINT)
RETURNS INTEGER AS $$
DECLARE
    v_max_position INTEGER;
BEGIN
    SELECT COALESCE(MAX(chain_position), 0) INTO v_max_position
    FROM document_signature_logs
    WHERE document_id = p_document_id;

    RETURN v_max_position + 1;
END;
$$ LANGUAGE plpgsql;

-- Create function to get last event hash for a document
CREATE OR REPLACE FUNCTION get_last_event_hash(p_document_id BIGINT)
RETURNS VARCHAR(64) AS $$
DECLARE
    v_last_hash VARCHAR(64);
BEGIN
    SELECT event_hash INTO v_last_hash
    FROM document_signature_logs
    WHERE document_id = p_document_id
    ORDER BY chain_position DESC
    LIMIT 1;

    RETURN v_last_hash;
END;
$$ LANGUAGE plpgsql;

-- Create function to log document signature event (main function)
CREATE OR REPLACE FUNCTION log_document_signature_event(
    p_document_id BIGINT,
    p_event_type VARCHAR(100),
    p_event_description TEXT DEFAULT NULL,
    p_user_id INTEGER DEFAULT NULL,
    p_event_data JSONB DEFAULT '{}'::jsonb,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_session_id VARCHAR(255) DEFAULT NULL
) RETURNS INTEGER AS $$
DECLARE
    v_event_id INTEGER;
    v_chain_position INTEGER;
    v_previous_hash VARCHAR(64);
    v_event_hash VARCHAR(64);
    v_user_name VARCHAR(255);
    v_user_role VARCHAR(100);
    v_user_email VARCHAR(255);
BEGIN
    -- Get user information if user_id provided
    IF p_user_id IS NOT NULL THEN
        SELECT name, signature_role, email
        INTO v_user_name, v_user_role, v_user_email
        FROM users
        WHERE id = p_user_id;
    END IF;

    -- Get next chain position
    v_chain_position := get_next_chain_position(p_document_id);

    -- Get previous event hash (NULL for first event)
    IF v_chain_position > 1 THEN
        v_previous_hash := get_last_event_hash(p_document_id);
    END IF;

    -- Generate event hash
    v_event_hash := generate_event_hash(
        p_document_id,
        p_event_type,
        NOW(),
        p_user_id,
        p_event_data,
        v_previous_hash
    );

    -- Insert the log entry
    INSERT INTO document_signature_logs (
        document_id,
        event_type,
        event_description,
        event_timestamp,
        user_id,
        user_name,
        user_role,
        user_email,
        ip_address,
        user_agent,
        session_id,
        event_data,
        event_hash,
        previous_event_hash,
        chain_position
    ) VALUES (
        p_document_id,
        p_event_type,
        p_event_description,
        NOW(),
        p_user_id,
        v_user_name,
        v_user_role,
        v_user_email,
        p_ip_address,
        p_user_agent,
        p_session_id,
        p_event_data,
        v_event_hash,
        v_previous_hash,
        v_chain_position
    ) RETURNING id INTO v_event_id;

    -- Verify the chain integrity after insertion
    PERFORM verify_document_log_chain(p_document_id);

    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to verify hash chain integrity
CREATE OR REPLACE FUNCTION verify_document_log_chain(p_document_id BIGINT)
RETURNS BOOLEAN AS $$
DECLARE
    v_current_record RECORD;
    v_expected_hash VARCHAR(64);
    v_chain_valid BOOLEAN := true;
BEGIN
    -- Check each event in the chain
    FOR v_current_record IN
        SELECT * FROM document_signature_logs
        WHERE document_id = p_document_id
        ORDER BY chain_position
    LOOP
        -- Generate expected hash for this event
        v_expected_hash := generate_event_hash(
            v_current_record.document_id,
            v_current_record.event_type,
            v_current_record.event_timestamp,
            v_current_record.user_id,
            v_current_record.event_data,
            v_current_record.previous_event_hash
        );

        -- Check if stored hash matches expected hash
        IF v_current_record.event_hash != v_expected_hash THEN
            v_chain_valid := false;

            -- Mark this event as unverified
            UPDATE document_signature_logs
            SET is_verified = false,
                verification_timestamp = NOW()
            WHERE id = v_current_record.id;
        ELSE
            -- Mark as verified
            UPDATE document_signature_logs
            SET is_verified = true,
                verification_timestamp = NOW()
            WHERE id = v_current_record.id;
        END IF;
    END LOOP;

    RETURN v_chain_valid;
END;
$$ LANGUAGE plpgsql;

-- Create function to get document audit trail
CREATE OR REPLACE FUNCTION get_document_audit_trail(p_document_id BIGINT)
RETURNS TABLE(
    chain_position INTEGER,
    event_type VARCHAR(100),
    event_description TEXT,
    event_timestamp TIMESTAMP WITH TIME ZONE,
    user_name VARCHAR(255),
    user_role VARCHAR(100),
    event_data JSONB,
    is_verified BOOLEAN,
    event_hash VARCHAR(64)
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        dsl.chain_position,
        dsl.event_type,
        dsl.event_description,
        dsl.event_timestamp,
        dsl.user_name,
        dsl.user_role,
        dsl.event_data,
        dsl.is_verified,
        dsl.event_hash
    FROM document_signature_logs dsl
    WHERE dsl.document_id = p_document_id
    ORDER BY dsl.chain_position;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically log events

-- Trigger for document signature events
CREATE OR REPLACE FUNCTION trigger_log_signature_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log signature creation
    IF TG_OP = 'INSERT' THEN
        PERFORM log_document_signature_event(
            NEW.document_id,
            'FIRMA_AVANZADA_CREADA',
            'Firma electrónica avanzada registrada',
            NEW.signer_user_id,
            jsonb_build_object(
                'signer_name', NEW.signer_name,
                'signer_role', NEW.signer_role,
                'signature_type', NEW.signature_type,
                'auth_method', NEW.auth_method,
                'ip_address', NEW.ip_address::TEXT
            ),
            NEW.ip_address,
            NEW.user_agent,
            NEW.session_id
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_signature_events ON document_signatures_advanced;
CREATE TRIGGER trg_log_signature_events
    AFTER INSERT ON document_signatures_advanced
    FOR EACH ROW EXECUTE FUNCTION trigger_log_signature_event();

-- Trigger for seal events
CREATE OR REPLACE FUNCTION trigger_log_seal_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log seal creation
    IF TG_OP = 'INSERT' THEN
        PERFORM log_document_signature_event(
            NEW.document_id,
            'SELLO_INSTITUCIONAL_APLICADO',
            'Sello digital institucional aplicado',
            NEW.authorized_user_id,
            jsonb_build_object(
                'seal_code', NEW.seal_code,
                'issued_by', NEW.issued_by,
                'authorized_role', NEW.authorized_role,
                'seal_type', NEW.seal_type
            )
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_seal_events ON document_seals;
CREATE TRIGGER trg_log_seal_events
    AFTER INSERT ON document_seals
    FOR EACH ROW EXECUTE FUNCTION trigger_log_seal_event();

-- Trigger for QR events
CREATE OR REPLACE FUNCTION trigger_log_qr_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log QR creation
    IF TG_OP = 'INSERT' THEN
        PERFORM log_document_signature_event(
            NEW.document_id,
            'QR_VERIFICACION_GENERADO',
            'Código QR de verificación generado',
            NULL, -- System generated
            jsonb_build_object(
                'qr_url', NEW.qr_url,
                'verification_token', NEW.verification_token::TEXT,
                'qr_size', NEW.qr_size,
                'qr_format', NEW.qr_format
            )
        );
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_log_qr_events ON document_qr_codes;
CREATE TRIGGER trg_log_qr_events
    AFTER INSERT ON document_qr_codes
    FOR EACH ROW EXECUTE FUNCTION trigger_log_qr_event();

COMMENT ON TABLE document_signature_logs IS 'Immutable audit logs with hash chain for document signing events';

-- Add missing columns to document_signature_logs table if they don't exist
DO $$
BEGIN
    -- Add user_name column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'user_name'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN user_name VARCHAR(255);
    END IF;

    -- Add user_role column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'user_role'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN user_role VARCHAR(100);
    END IF;

    -- Add user_email column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'user_email'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN user_email VARCHAR(255);
    END IF;

    -- Add ip_address column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'ip_address'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN ip_address INET;
    END IF;

    -- Add user_agent column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'user_agent'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN user_agent TEXT;
    END IF;

    -- Add session_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'session_id'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN session_id VARCHAR(255);
    END IF;

    -- Add client_info column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'client_info'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN client_info JSONB DEFAULT '{}'::jsonb;
    END IF;

    -- Add verification_timestamp column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'document_signature_logs'
          AND column_name = 'verification_timestamp'
    ) THEN
        ALTER TABLE document_signature_logs ADD COLUMN verification_timestamp TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Create view for audit dashboard (after all columns are added)
CREATE OR REPLACE VIEW document_audit_dashboard AS
SELECT
    d.id AS document_id,
    d.signature_status,
    d.is_locked,

    -- Audit summary
    COUNT(dsl.id) AS total_events,
    COUNT(CASE WHEN dsl.is_verified = false THEN 1 END) AS corrupted_events,
    MAX(dsl.event_timestamp) AS last_event_at,

    -- Chain verification status
    CASE
        WHEN COUNT(dsl.id) = 0 THEN 'NO_LOGS'
        WHEN COUNT(CASE WHEN dsl.is_verified = false THEN 1 END) > 0 THEN 'CORRUPTED'
        WHEN COUNT(dsl.id) > 0 AND COUNT(CASE WHEN dsl.is_verified = false THEN 1 END) = 0 THEN 'VERIFIED'
        ELSE 'UNKNOWN'
    END AS chain_status,

    -- Recent events
    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'event_type', event_type,
                'timestamp', event_timestamp,
                'user', user_name
            )
        )
        FROM (
            SELECT event_type, event_timestamp, user_name
            FROM document_signature_logs
            WHERE document_id = d.id
            ORDER BY chain_position DESC
            LIMIT 3
        ) recent
    ) AS recent_events

FROM documents d
LEFT JOIN document_signature_logs dsl ON dsl.document_id = d.id
GROUP BY d.id, d.signature_status, d.is_locked;

COMMENT ON VIEW document_audit_dashboard IS 'Dashboard view of document audit status and chain verification';

-- Grant permissions
GRANT SELECT ON document_signature_logs TO PUBLIC;
GRANT SELECT ON document_audit_dashboard TO PUBLIC;

COMMIT;
