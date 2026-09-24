CREATE TABLE IF NOT EXISTS attendance_follow_up_meetings (
  id BIGSERIAL PRIMARY KEY,
  collaborator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  scheduled_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  breach_date DATE NOT NULL,
  breach_type TEXT NOT NULL,
  meeting_date DATE NOT NULL,
  start_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  reason TEXT,
  calendar_event_id TEXT,
  calendar_event_link TEXT,
  calendar_event_calendar_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_follow_up_meetings_duration_check
    CHECK (duration_minutes BETWEEN 15 AND 120),
  CONSTRAINT attendance_follow_up_meetings_unique_breach
    UNIQUE (collaborator_id, breach_date, breach_type)
);

CREATE INDEX IF NOT EXISTS idx_attendance_follow_up_meetings_collaborator_date
  ON attendance_follow_up_meetings (collaborator_id, breach_date DESC);
