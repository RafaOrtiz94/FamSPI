BEGIN;

CREATE TABLE IF NOT EXISTS attendance_pdf_versions (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period_id BIGINT REFERENCES attendance_periods(id) ON DELETE SET NULL,
  period_type TEXT NOT NULL CHECK (period_type IN ('monthly','annual')),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  version_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','replaced','voided')),
  generation_reason TEXT,
  generated_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  hash_sha256 TEXT NOT NULL,
  hash_algorithm TEXT NOT NULL DEFAULT 'SHA-256',
  previous_version_id BIGINT REFERENCES attendance_pdf_versions(id) ON DELETE SET NULL,
  document_storage_ref TEXT,
  applied_regularization_ids JSONB,
  request_id TEXT,
  correlation_id TEXT,
  source_channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attendance_pdf_version UNIQUE (user_id, period_type, period_start, period_end, version_number)
);

CREATE INDEX IF NOT EXISTS idx_attendance_pdf_versions_user_period
  ON attendance_pdf_versions(user_id, period_type, period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_attendance_pdf_versions_status
  ON attendance_pdf_versions(status, generated_at DESC);

CREATE TABLE IF NOT EXISTS attendance_audit_events (
  id BIGSERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  affected_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  endpoint TEXT,
  method TEXT,
  old_value JSONB,
  new_value JSONB,
  result TEXT,
  reason TEXT,
  request_id TEXT,
  correlation_id TEXT,
  source_channel TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_audit_events_actor_time
  ON attendance_audit_events(actor_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_events_action_time
  ON attendance_audit_events(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_audit_events_request
  ON attendance_audit_events(request_id, correlation_id);

COMMIT;
