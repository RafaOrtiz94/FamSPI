BEGIN;

CREATE TABLE IF NOT EXISTS attendance_geofence_reference_points (
  id BIGSERIAL PRIMARY KEY,
  scope_type TEXT NOT NULL CHECK (scope_type IN ('office','client','prospect')),
  scope_id TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  radius_meters NUMERIC(8,2) NOT NULL DEFAULT 200,
  sample_count INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'learning' CHECK (status IN ('learning','official','disabled')),
  learned_from JSONB,
  promoted_to_official_at TIMESTAMPTZ,
  promoted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attendance_geofence_scope UNIQUE (scope_type, scope_id)
);

CREATE INDEX IF NOT EXISTS idx_attendance_geofence_status
  ON attendance_geofence_reference_points(status, scope_type);

COMMIT;
