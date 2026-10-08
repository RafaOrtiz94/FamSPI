-- Especificacion tecnica de activos TI: redaccion guardada (JSON con las
-- secciones del PDF) y ultimo PDF publicado en Drive.
-- Tambien se aplica en runtime desde ensureTiAssetsSchema (tiAssets.service.js).
ALTER TABLE public.ti_assets
  ADD COLUMN IF NOT EXISTS tech_spec_narrative JSONB,
  ADD COLUMN IF NOT EXISTS tech_spec_narrative_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS tech_spec_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS tech_spec_drive_url TEXT;
