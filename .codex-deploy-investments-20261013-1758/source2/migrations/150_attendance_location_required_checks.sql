-- 150_attendance_location_required_checks.sql
-- Enforce location presence for new attendance marks (keeps historical data untouched via NOT VALID).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_uar_entry_location_required') THEN
    ALTER TABLE user_attendance_records
      ADD CONSTRAINT chk_uar_entry_location_required
      CHECK (entry_time IS NULL OR COALESCE(NULLIF(btrim(entry_location), ''), '') <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_uar_lunch_start_location_required') THEN
    ALTER TABLE user_attendance_records
      ADD CONSTRAINT chk_uar_lunch_start_location_required
      CHECK (lunch_start_time IS NULL OR COALESCE(NULLIF(btrim(lunch_start_location), ''), '') <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_uar_lunch_end_location_required') THEN
    ALTER TABLE user_attendance_records
      ADD CONSTRAINT chk_uar_lunch_end_location_required
      CHECK (lunch_end_time IS NULL OR COALESCE(NULLIF(btrim(lunch_end_location), ''), '') <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_uar_exit_location_required') THEN
    ALTER TABLE user_attendance_records
      ADD CONSTRAINT chk_uar_exit_location_required
      CHECK (exit_time IS NULL OR COALESCE(NULLIF(btrim(exit_location), ''), '') <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_att_ex_start_location_required') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT chk_att_ex_start_location_required
      CHECK (start_time IS NULL OR COALESCE(NULLIF(btrim(start_location), ''), '') <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_att_ex_arrival_location_required') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT chk_att_ex_arrival_location_required
      CHECK (arrival_time IS NULL OR COALESCE(NULLIF(btrim(arrival_location), ''), '') <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_att_ex_departure_location_required') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT chk_att_ex_departure_location_required
      CHECK (departure_time IS NULL OR COALESCE(NULLIF(btrim(departure_location), ''), '') <> '')
      NOT VALID;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_att_ex_return_location_required') THEN
    ALTER TABLE attendance_exceptions
      ADD CONSTRAINT chk_att_ex_return_location_required
      CHECK (return_time IS NULL OR COALESCE(NULLIF(btrim(return_location), ''), '') <> '')
      NOT VALID;
  END IF;
END $$;
