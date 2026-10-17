-- 159_attendance_perf_and_consistency.sql
-- Performance and consistency improvements for the attendance module.
-- 1. Partial index on attendance_exceptions for active (non-COMPLETED) records.
-- 2. Composite index for operational flow queries (type + user_id).
-- 3. Partial unique index on attendance_pending_locations to prevent duplicate
--    GPS-failure entries per (user, action, target, date) while status = 'pending'.

BEGIN;

-- Active exceptions are queried on every clock-in/out — partial index cuts seq scan.
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_active_user
  ON attendance_exceptions (user_id, id DESC)
  WHERE UPPER(COALESCE(status, '')) <> 'COMPLETED';

-- Operational-flow filter uses type in ALL()/ANY() — this index helps that predicate.
CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_type_user
  ON attendance_exceptions (LOWER(COALESCE(type, '')), user_id);

-- Prevent duplicate pending-location rows for the same GPS failure event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_pending_loc_unique_active
  ON attendance_pending_locations (
    user_id,
    action_key,
    COALESCE(target_key, ''),
    COALESCE(business_date, '1970-01-01'::date)
  )
  WHERE status = 'pending';

COMMIT;
