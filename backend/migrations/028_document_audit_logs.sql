-- Migration: Document Audit Logs - Basic Table - Phase 3
-- Date: 2025-12-18
-- Description: Creates basic immutable audit logs table

-- Create minimal document_signature_logs table
CREATE TABLE IF NOT EXISTS document_signature_logs (
    id SERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    event_description TEXT,
    event_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id INTEGER REFERENCES users(id),
    event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    event_hash VARCHAR(64) NOT NULL,
    previous_event_hash VARCHAR(64),
    chain_position INTEGER NOT NULL,
    is_verified BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

COMMIT;
