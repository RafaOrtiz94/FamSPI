-- 103_business_case_idempotency_and_feature_flags.sql
-- Objetivo:
-- 1) Garantizar idempotencia en guardados críticos de Business Case.
-- 2) Gestionar feature flags de autosave por sección y rol sin redeploy.

CREATE TABLE IF NOT EXISTS business_case_idempotency_keys (
  id BIGSERIAL PRIMARY KEY,
  operation_scope VARCHAR(120) NOT NULL,
  idempotency_key VARCHAR(200) NOT NULL,
  business_case_id UUID,
  payload_hash CHAR(64) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'processing',
  http_status INTEGER,
  response_payload JSONB,
  error_message TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  CONSTRAINT business_case_idempotency_keys_status_check
    CHECK (status IN ('processing', 'completed', 'failed')),
  CONSTRAINT business_case_idempotency_keys_http_status_check
    CHECK (http_status IS NULL OR (http_status >= 100 AND http_status <= 599)),
  UNIQUE (operation_scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bc_idempotency_business_case
  ON business_case_idempotency_keys (business_case_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bc_idempotency_status
  ON business_case_idempotency_keys (status, updated_at DESC);

CREATE TABLE IF NOT EXISTS business_case_feature_flags (
  id BIGSERIAL PRIMARY KEY,
  feature_name VARCHAR(80) NOT NULL DEFAULT 'autosave',
  section_key VARCHAR(80) NOT NULL,
  role_key VARCHAR(80) NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (feature_name, section_key, role_key)
);

CREATE INDEX IF NOT EXISTS idx_bc_feature_flags_lookup
  ON business_case_feature_flags (feature_name, section_key, role_key, is_enabled);
