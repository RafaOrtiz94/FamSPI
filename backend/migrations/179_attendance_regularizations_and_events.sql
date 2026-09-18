BEGIN;

CREATE TABLE IF NOT EXISTS attendance_regularizations (
  id BIGSERIAL PRIMARY KEY,
  requester_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  affected_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  regularization_type TEXT NOT NULL CHECK (regularization_type IN (
    'late_arrival','early_departure','missing_clock_in','missing_lunch_out','missing_lunch_in','missing_clock_out',
    'wrong_location','field_operation_adjustment','client_visit_adjustment','offline_sync_adjustment'
  )),
  reason TEXT NOT NULL,
  original_timestamp TIMESTAMPTZ,
  requested_timestamp TIMESTAMPTZ,
  evidence JSONB,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','pending','approved','rejected','cancelled','applied')),
  approver_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  approver_comment TEXT,
  approved_at TIMESTAMPTZ,
  rejected_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  applied_at TIMESTAMPTZ,
  affects_acta BOOLEAN NOT NULL DEFAULT TRUE,
  period_id BIGINT REFERENCES attendance_periods(id) ON DELETE SET NULL,
  request_id TEXT,
  correlation_id TEXT,
  source_channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_regularizations_affected_date
  ON attendance_regularizations(affected_user_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_regularizations_status
  ON attendance_regularizations(status, created_at DESC);

CREATE TABLE IF NOT EXISTS attendance_regularization_events (
  id BIGSERIAL PRIMARY KEY,
  regularization_id BIGINT NOT NULL REFERENCES attendance_regularizations(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  actor_role TEXT,
  comment TEXT,
  request_id TEXT,
  correlation_id TEXT,
  ip TEXT,
  user_agent TEXT,
  source_channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_regularization_events_reg
  ON attendance_regularization_events(regularization_id, created_at DESC);

COMMIT;
