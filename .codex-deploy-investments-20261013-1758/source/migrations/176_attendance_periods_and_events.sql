BEGIN;

CREATE TABLE IF NOT EXISTS attendance_periods (
  id BIGSERIAL PRIMARY KEY,
  period_key TEXT NOT NULL UNIQUE,
  period_year INTEGER NOT NULL,
  period_month INTEGER NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  starts_on DATE NOT NULL,
  ends_on DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_review','pending_signatures','closed','reopened','locked')),
  close_scheduled_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  closed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reopened_at TIMESTAMPTZ,
  reopened_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  reopen_count INTEGER NOT NULL DEFAULT 0,
  lock_reason TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_attendance_periods_dates CHECK (starts_on <= ends_on)
);

CREATE INDEX IF NOT EXISTS idx_attendance_periods_status ON attendance_periods(status);
CREATE INDEX IF NOT EXISTS idx_attendance_periods_year_month ON attendance_periods(period_year, period_month);

CREATE TABLE IF NOT EXISTS attendance_period_events (
  id BIGSERIAL PRIMARY KEY,
  period_id BIGINT NOT NULL REFERENCES attendance_periods(id) ON DELETE CASCADE,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  request_id TEXT,
  correlation_id TEXT,
  ip TEXT,
  user_agent TEXT,
  source_channel TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_period_events_period ON attendance_period_events(period_id, created_at DESC);

COMMIT;
