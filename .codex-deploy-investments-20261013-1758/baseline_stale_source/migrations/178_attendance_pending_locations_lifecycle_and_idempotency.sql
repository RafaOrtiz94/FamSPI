BEGIN;

ALTER TABLE attendance_pending_locations
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS retry_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS regularization_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS displayed_message TEXT,
  ADD COLUMN IF NOT EXISTS failure_reason_code TEXT,
  ADD COLUMN IF NOT EXISTS latitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS longitude NUMERIC(10,7),
  ADD COLUMN IF NOT EXISTS location_accuracy_meters NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS server_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS client_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS source_channel TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS correlation_id TEXT,
  ADD COLUMN IF NOT EXISTS device_id TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='attendance_pending_locations' AND column_name='status'
  ) THEN
    ALTER TABLE attendance_pending_locations
      DROP CONSTRAINT IF EXISTS chk_attendance_pending_locations_status;

    ALTER TABLE attendance_pending_locations
      ADD CONSTRAINT chk_attendance_pending_locations_status
      CHECK (status IN ('pending','retry_requested','resolved','rejected','expired','regularization_required'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_att_pending_status_expires ON attendance_pending_locations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_att_pending_request_id ON attendance_pending_locations(request_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_att_pending_active_attempt
  ON attendance_pending_locations(
    user_id,
    action_key,
    COALESCE(target_key, ''),
    COALESCE(business_date, '1970-01-01'::date)
  )
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS attendance_idempotency_keys (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  request_id TEXT,
  correlation_id TEXT,
  device_id TEXT,
  source_channel TEXT,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  response_status INTEGER,
  response_payload JSONB,
  created_record_table TEXT,
  created_record_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_attendance_idempotency_active
  ON attendance_idempotency_keys(user_id, action_type, request_hash);

CREATE INDEX IF NOT EXISTS idx_attendance_idempotency_expiry
  ON attendance_idempotency_keys(expires_at);

COMMIT;
