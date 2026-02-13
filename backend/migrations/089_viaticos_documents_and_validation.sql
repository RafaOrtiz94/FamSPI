-- Migration: 089_viaticos_documents_and_validation.sql
-- Description: Madurez de viaticos (documentos, validacion con asistencia y reglas de kilometraje)
-- Date: 2026-02-12

ALTER TABLE travel_allowances
  ADD COLUMN IF NOT EXISTS trip_type TEXT,
  ADD COLUMN IF NOT EXISTS distance_km NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS outside_labor_area BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS outside_labor_area_reason TEXT,
  ADD COLUMN IF NOT EXISTS fuel_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquidation_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approved_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS attendance_check_status VARCHAR(20) NOT NULL DEFAULT 'unchecked',
  ADD COLUMN IF NOT EXISTS attendance_check_payload JSONB,
  ADD COLUMN IF NOT EXISTS reviewed_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

ALTER TABLE travel_allowances
  ALTER COLUMN source_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name TEXT;
BEGIN
  -- Drop known constraint name if it already exists
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'travel_allowances_source_type_check'
      AND conrelid = 'travel_allowances'::regclass
  ) THEN
    ALTER TABLE travel_allowances DROP CONSTRAINT travel_allowances_source_type_check;
  END IF;

  -- Drop any legacy source_type check constraints (different names/definitions)
  SELECT conname
    INTO constraint_name
  FROM pg_constraint
  WHERE conrelid = 'travel_allowances'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%source_type%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE travel_allowances DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'travel_allowances_source_type_check'
      AND conrelid = 'travel_allowances'::regclass
  ) THEN
    ALTER TABLE travel_allowances
      ADD CONSTRAINT travel_allowances_source_type_check
      CHECK (source_type IN ('client_visit', 'prospect_visit', 'manual_trip'));
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'travel_allowances_source_type_source_id_key'
      AND conrelid = 'travel_allowances'::regclass
  ) THEN
    ALTER TABLE travel_allowances DROP CONSTRAINT travel_allowances_source_type_source_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_travel_allowances_visit_source
  ON travel_allowances(source_type, source_id)
  WHERE source_id IS NOT NULL
    AND source_type IN ('client_visit', 'prospect_visit');

DO $$
DECLARE
  status_constraint_name TEXT;
BEGIN
  SELECT conname
    INTO status_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'travel_allowances'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%attendance_check_status%';

  IF status_constraint_name IS NULL THEN
    ALTER TABLE travel_allowances
      ADD CONSTRAINT travel_allowances_attendance_check_status
      CHECK (attendance_check_status IN ('unchecked', 'matched', 'review', 'mismatch', 'no_attendance', 'insufficient_geo'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS travel_allowance_documents (
  id BIGSERIAL PRIMARY KEY,
  allowance_id BIGINT NOT NULL REFERENCES travel_allowances(id) ON DELETE CASCADE,
  doc_type VARCHAR(30) NOT NULL CHECK (doc_type IN ('invoice', 'liquidation', 'support')),
  file_name TEXT NOT NULL,
  mime_type TEXT,
  drive_file_id TEXT,
  drive_link TEXT,
  amount NUMERIC(12,2),
  expense_date DATE,
  invoice_number TEXT,
  notes TEXT,
  uploaded_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_documents_allowance_id
  ON travel_allowance_documents(allowance_id);

CREATE INDEX IF NOT EXISTS idx_travel_allowance_documents_doc_type
  ON travel_allowance_documents(doc_type);
