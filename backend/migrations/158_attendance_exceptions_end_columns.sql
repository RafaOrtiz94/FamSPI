-- 158_attendance_exceptions_end_columns.sql
-- Adds end_time, end_location, and updated_at to attendance_exceptions.
-- These are referenced by clockInOperational, clockCloseTrip, and updateExceptionStatus
-- but were missing from the original schema and all prior migrations.

BEGIN;

ALTER TABLE attendance_exceptions
  ADD COLUMN IF NOT EXISTS end_time       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_location   TEXT,
  ADD COLUMN IF NOT EXISTS updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_updated_at
  ON attendance_exceptions (updated_at DESC);

COMMENT ON COLUMN attendance_exceptions.end_time     IS 'Timestamp when the operational exception was fully closed';
COMMENT ON COLUMN attendance_exceptions.end_location IS 'GPS location string (lat,lng) at the moment the exception was closed';
COMMENT ON COLUMN attendance_exceptions.updated_at   IS 'Last modification timestamp, maintained by application logic';

COMMIT;
