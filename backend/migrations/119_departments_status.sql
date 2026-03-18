-- 119_departments_status.sql
-- Agrega control de estado logico a departments

ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

UPDATE departments
   SET status = 'active'
 WHERE status IS NULL OR trim(status) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'departments_status_check'
  ) THEN
    ALTER TABLE departments
      ADD CONSTRAINT departments_status_check
      CHECK (status IN ('active', 'inactive'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_departments_status
  ON departments(status);
