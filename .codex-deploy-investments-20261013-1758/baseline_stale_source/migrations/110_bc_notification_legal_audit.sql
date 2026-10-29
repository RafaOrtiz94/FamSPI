-- Auditoria legal para notificaciones agrupadas del flujo Business Case
CREATE TABLE IF NOT EXISTS bc_notification_legal_audit (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL,
  actor_user_id INTEGER NULL,
  actor_email TEXT NULL,
  flow_type TEXT NULL,
  client_name TEXT NULL,
  process_code TEXT NOT NULL,
  source TEXT NOT NULL,
  email_to TEXT NOT NULL,
  email_cc TEXT[] NOT NULL DEFAULT '{}',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bc_notification_legal_audit_business_case
  ON bc_notification_legal_audit (business_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bc_notification_legal_audit_process_code
  ON bc_notification_legal_audit (process_code, created_at DESC);
