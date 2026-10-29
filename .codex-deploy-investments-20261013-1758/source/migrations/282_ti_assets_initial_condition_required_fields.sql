ALTER TABLE public.ti_assets
  ADD COLUMN IF NOT EXISTS physical_condition_score INTEGER,
  ADD COLUMN IF NOT EXISTS functional_condition_score INTEGER,
  ADD COLUMN IF NOT EXISTS initial_condition_photo_1_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS initial_condition_photo_1_url TEXT,
  ADD COLUMN IF NOT EXISTS initial_condition_photo_1_sha256 TEXT,
  ADD COLUMN IF NOT EXISTS initial_condition_photo_2_drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS initial_condition_photo_2_url TEXT,
  ADD COLUMN IF NOT EXISTS initial_condition_photo_2_sha256 TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ti_assets_physical_condition_score_check'
  ) THEN
    ALTER TABLE public.ti_assets
      ADD CONSTRAINT ti_assets_physical_condition_score_check
      CHECK (physical_condition_score IS NULL OR physical_condition_score BETWEEN 1 AND 10);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ti_assets_functional_condition_score_check'
  ) THEN
    ALTER TABLE public.ti_assets
      ADD CONSTRAINT ti_assets_functional_condition_score_check
      CHECK (functional_condition_score IS NULL OR functional_condition_score BETWEEN 1 AND 10);
  END IF;
END $$;
