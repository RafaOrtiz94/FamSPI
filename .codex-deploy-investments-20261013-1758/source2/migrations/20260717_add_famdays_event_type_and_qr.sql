ALTER TABLE kickoff_events
  ADD COLUMN IF NOT EXISTS event_type VARCHAR(40) NOT NULL DEFAULT 'kickoff';

UPDATE kickoff_events
SET event_type = 'kickoff'
WHERE event_type IS NULL OR TRIM(event_type) = '';

CREATE INDEX IF NOT EXISTS idx_kickoff_events_event_type_status
  ON kickoff_events (event_type, status, event_date);

CREATE TABLE IF NOT EXISTS famdays_event_qr_tokens (
  id SERIAL PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES kickoff_events(id) ON DELETE CASCADE,
  token VARCHAR(128) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_famdays_event_qr_tokens_event_active
  ON famdays_event_qr_tokens (event_id, is_active);

CREATE TABLE IF NOT EXISTS famdays_configurators (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  assigned_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);
