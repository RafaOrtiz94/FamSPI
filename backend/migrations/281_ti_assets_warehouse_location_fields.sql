ALTER TABLE public.ti_assets
  ADD COLUMN IF NOT EXISTS warehouse_address TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_section TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_shelf TEXT;
