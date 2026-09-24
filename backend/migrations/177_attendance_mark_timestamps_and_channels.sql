BEGIN;

ALTER TABLE user_attendance_records
  ADD COLUMN IF NOT EXISTS source_channel TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_mark_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_skew_ms BIGINT,
  ADD COLUMN IF NOT EXISTS is_suspicious_time BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE attendance_exceptions
  ADD COLUMN IF NOT EXISTS source_channel TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS device_id TEXT,
  ADD COLUMN IF NOT EXISTS client_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS device_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_mark_timestamp TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clock_skew_ms BIGINT,
  ADD COLUMN IF NOT EXISTS is_suspicious_time BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_uar_request_id ON user_attendance_records(request_id);
CREATE INDEX IF NOT EXISTS idx_uar_correlation_id ON user_attendance_records(correlation_id);
CREATE INDEX IF NOT EXISTS idx_ae_request_id ON attendance_exceptions(request_id);
CREATE INDEX IF NOT EXISTS idx_ae_correlation_id ON attendance_exceptions(correlation_id);

COMMIT;
