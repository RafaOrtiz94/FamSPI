-- Migration: 054_notification_recipients_config.sql
-- Description: Create table for configurable notification recipients by event and role
-- Date: 2026-01-13
-- Author: FASE 2 Implementation

-- Create notification recipients configuration table
CREATE TABLE IF NOT EXISTS notification_recipients_config (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL, -- e.g., 'state_transition', 'approval', 'created'
  event_source VARCHAR(100) NOT NULL, -- e.g., 'business_case', 'requests'
  role VARCHAR(50), -- role name (e.g., 'viabilidad', 'jefe_comercial') - can be NULL for user-specific
  user_id INTEGER REFERENCES users(id), -- specific user ID - can be NULL for role-based
  send_email BOOLEAN DEFAULT true,
  send_chat BOOLEAN DEFAULT false,
  send_in_app BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 1, -- 0-3 (0=lowest, 3=highest)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  -- Ensure unique combinations
  UNIQUE(event_type, event_source, role, user_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_notification_recipients_event ON notification_recipients_config(event_type, event_source);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_role ON notification_recipients_config(role);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients_config(user_id);

-- Comments for documentation
COMMENT ON TABLE notification_recipients_config IS 'Configurable notification recipients by event type and role/user';
COMMENT ON COLUMN notification_recipients_config.event_type IS 'Type of event (e.g., state_transition, approval, created)';
COMMENT ON COLUMN notification_recipients_config.event_source IS 'Source module (e.g., business_case, requests)';
COMMENT ON COLUMN notification_recipients_config.role IS 'Role name for role-based notifications';
COMMENT ON COLUMN notification_recipients_config.user_id IS 'Specific user ID for user-specific notifications';
COMMENT ON COLUMN notification_recipients_config.send_email IS 'Whether to send email notifications';
COMMENT ON COLUMN notification_recipients_config.send_chat IS 'Whether to send Google Chat notifications';
COMMENT ON COLUMN notification_recipients_config.send_in_app IS 'Whether to show in-app notifications';
COMMENT ON COLUMN notification_recipients_config.priority IS 'Notification priority (0-3)';

-- Initial data - Business Case notifications
INSERT INTO notification_recipients_config (event_type, event_source, role, send_email, send_chat, priority) VALUES
  ('state_transition', 'business_case', 'viabilidad', true, true, 3),
  ('state_transition', 'business_case', 'jefe_comercial', true, false, 2),
  ('state_transition', 'business_case', 'operaciones', true, true, 2),
  ('state_transition', 'business_case', 'gerencia', true, true, 3),
  ('created', 'business_case', NULL, false, false, 1), -- Creator gets in-app only
  ('equipment_added', 'business_case', NULL, false, false, 0), -- In-app only for equipment changes
  ('determination_added', 'business_case', NULL, false, false, 0), -- In-app only for determinations
  ('calculation_updated', 'business_case', NULL, false, false, 1); -- In-app for calculation changes

-- Initial data - Requests notifications
INSERT INTO notification_recipients_config (event_type, event_source, role, send_email, send_chat, priority) VALUES
  ('approval', 'requests', NULL, true, false, 2), -- Requester gets email on approval
  ('rejection', 'requests', NULL, true, false, 2), -- Requester gets email on rejection
  ('assigned', 'requests', NULL, true, false, 1), -- Assignee gets email notification
  ('status_changed', 'requests', NULL, false, false, 1), -- In-app for status changes
  ('completed', 'requests', NULL, true, false, 1), -- Requester gets email when completed
  ('comment_added', 'requests', NULL, false, false, 0), -- In-app for comments
  ('attachment_added', 'requests', NULL, false, false, 0); -- In-app for attachments

-- Function to get recipients for an event (used by NotificationManager)
CREATE OR REPLACE FUNCTION get_notification_recipients(
  p_event_type VARCHAR(100),
  p_event_source VARCHAR(100)
)
RETURNS TABLE (
  user_id INTEGER,
  send_email BOOLEAN,
  send_chat BOOLEAN,
  send_in_app BOOLEAN,
  priority INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(nrc.user_id, u.id) as user_id,
    nrc.send_email,
    nrc.send_chat,
    nrc.send_in_app,
    nrc.priority
  FROM notification_recipients_config nrc
  LEFT JOIN users u ON nrc.role = u.role
  WHERE nrc.event_type = p_event_type
    AND nrc.event_source = p_event_source
    AND (nrc.user_id IS NOT NULL OR u.id IS NOT NULL)
    AND u.active = true;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_recipients_config TO spi_user;
GRANT EXECUTE ON FUNCTION get_notification_recipients(VARCHAR(100), VARCHAR(100)) TO spi_user;