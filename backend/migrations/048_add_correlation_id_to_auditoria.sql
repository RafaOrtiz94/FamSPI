-- Migration: Add correlation_id to auditoria.logs for session tracking
-- Description: Adds correlation_id column to enable tracking user actions within the same login session
-- Date: 2026-01-08
-- Version: 048

-- Add correlation_id column to auditoria.logs
ALTER TABLE auditoria.logs ADD COLUMN IF NOT EXISTS correlation_id UUID;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_auditoria_logs_correlation_id ON auditoria.logs(correlation_id);

-- Add comment for documentation
COMMENT ON COLUMN auditoria.logs.correlation_id IS 'Correlation ID for tracking user actions within the same login session';

-- Optional: Add correlation_id to user_sessions for session correlation
ALTER TABLE user_sessions ADD COLUMN IF NOT EXISTS correlation_id UUID;
CREATE INDEX IF NOT EXISTS idx_user_sessions_correlation_id ON user_sessions(correlation_id);
COMMENT ON COLUMN user_sessions.correlation_id IS 'Correlation ID linking sessions to audit logs';