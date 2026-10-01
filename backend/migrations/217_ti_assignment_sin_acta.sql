-- Migration 217: columnas sin_acta y evidencia en ti_asset_assignments
ALTER TABLE public.ti_asset_assignments
  ADD COLUMN IF NOT EXISTS sin_acta BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS evidence_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS evidence_file_url TEXT;
