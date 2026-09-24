ALTER TABLE public.attendance_exceptions
  ADD COLUMN IF NOT EXISTS operational_scope TEXT,
  ADD COLUMN IF NOT EXISTS operational_category TEXT,
  ADD COLUMN IF NOT EXISTS uses_personal_vehicle BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS odometer_start_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS odometer_end_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS odometer_distance_km NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS odometer_start_photo_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS odometer_start_photo_drive_url TEXT,
  ADD COLUMN IF NOT EXISTS odometer_end_photo_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS odometer_end_photo_drive_url TEXT;

ALTER TABLE public.attendance_exceptions
  DROP CONSTRAINT IF EXISTS attendance_exceptions_operational_scope_check;

ALTER TABLE public.attendance_exceptions
  ADD CONSTRAINT attendance_exceptions_operational_scope_check
  CHECK (
    operational_scope IS NULL
    OR operational_scope IN ('campo', 'oficina')
  );

ALTER TABLE public.attendance_exceptions
  DROP CONSTRAINT IF EXISTS attendance_exceptions_odometer_non_negative_check;

ALTER TABLE public.attendance_exceptions
  ADD CONSTRAINT attendance_exceptions_odometer_non_negative_check
  CHECK (
    (odometer_start_km IS NULL OR odometer_start_km >= 0)
    AND (odometer_end_km IS NULL OR odometer_end_km >= 0)
    AND (odometer_distance_km IS NULL OR odometer_distance_km >= 0)
  );

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_operational_category
  ON public.attendance_exceptions (operational_category)
  WHERE operational_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_attendance_exceptions_personal_vehicle
  ON public.attendance_exceptions (uses_personal_vehicle)
  WHERE uses_personal_vehicle = TRUE;
