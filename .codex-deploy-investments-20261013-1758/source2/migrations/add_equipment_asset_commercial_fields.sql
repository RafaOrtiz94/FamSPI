ALTER TABLE public.equipment_assets
  ADD COLUMN IF NOT EXISTS sale_price numeric(14,2),
  ADD COLUMN IF NOT EXISTS asset_condition text,
  ADD COLUMN IF NOT EXISTS retired_at date,
  ADD COLUMN IF NOT EXISTS delivered_at date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'equipment_assets_asset_condition_check'
      AND conrelid = 'public.equipment_assets'::regclass
  ) THEN
    ALTER TABLE public.equipment_assets
      ADD CONSTRAINT equipment_assets_asset_condition_check
      CHECK (asset_condition IS NULL OR asset_condition IN ('nuevo', 'cu'));
  END IF;
END $$;
