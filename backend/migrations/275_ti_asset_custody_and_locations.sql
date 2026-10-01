-- TI asset custody expansion. Additive and idempotent.
-- Existing collaborator assignment columns remain the compatibility contract.

ALTER TABLE public.ti_assets
  ADD COLUMN IF NOT EXISTS custody_type TEXT,
  ADD COLUMN IF NOT EXISTS warehouse_code TEXT,
  ADD COLUMN IF NOT EXISTS client_id INTEGER,
  ADD COLUMN IF NOT EXISTS client_location_label TEXT,
  ADD COLUMN IF NOT EXISTS location_label TEXT,
  ADD COLUMN IF NOT EXISTS custodian_user_id INTEGER,
  ADD COLUMN IF NOT EXISTS ownership_type TEXT,
  ADD COLUMN IF NOT EXISTS usage_context TEXT;

ALTER TABLE public.ti_assets
  ALTER COLUMN custody_type SET DEFAULT 'warehouse',
  ALTER COLUMN ownership_type SET DEFAULT 'company',
  ALTER COLUMN usage_context SET DEFAULT 'internal';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ti_assets_custody_type_check') THEN
    ALTER TABLE public.ti_assets ADD CONSTRAINT ti_assets_custody_type_check
      CHECK (custody_type IN ('warehouse', 'collaborator', 'client', 'vendor', 'unknown'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ti_assets_ownership_type_check') THEN
    ALTER TABLE public.ti_assets ADD CONSTRAINT ti_assets_ownership_type_check
      CHECK (ownership_type IN ('company', 'leased', 'client', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ti_assets_usage_context_check') THEN
    ALTER TABLE public.ti_assets ADD CONSTRAINT ti_assets_usage_context_check
      CHECK (usage_context IN ('internal', 'customer_site', 'loan', 'spare', 'demo'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ti_assets_client_fkey') THEN
    ALTER TABLE public.ti_assets ADD CONSTRAINT ti_assets_client_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ti_assets_custodian_user_fkey') THEN
    ALTER TABLE public.ti_assets ADD CONSTRAINT ti_assets_custodian_user_fkey
      FOREIGN KEY (custodian_user_id) REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

UPDATE public.ti_assets
   SET custody_type = 'collaborator',
       custodian_user_id = assigned_to_user_id,
       ownership_type = COALESCE(ownership_type, 'company'),
       usage_context = COALESCE(usage_context, 'internal')
 WHERE assigned_to_user_id IS NOT NULL;

UPDATE public.ti_assets
   SET custody_type = 'warehouse',
       warehouse_code = COALESCE(NULLIF(BTRIM(warehouse_code), ''), 'BODEGA_TI_MAIN'),
       ownership_type = COALESCE(ownership_type, 'company'),
       usage_context = COALESCE(usage_context, 'internal')
 WHERE assigned_to_user_id IS NULL
   AND (custody_type IS NULL OR custody_type = 'warehouse');

UPDATE public.ti_assets
   SET custody_type = COALESCE(custody_type, 'unknown'),
       ownership_type = COALESCE(ownership_type, 'company'),
       usage_context = COALESCE(usage_context, 'internal');

CREATE INDEX IF NOT EXISTS idx_ti_assets_custody_type ON public.ti_assets(custody_type);
CREATE INDEX IF NOT EXISTS idx_ti_assets_warehouse_code ON public.ti_assets(warehouse_code) WHERE warehouse_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ti_assets_client_id ON public.ti_assets(client_id) WHERE client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ti_assets_custodian_user ON public.ti_assets(custodian_user_id) WHERE custodian_user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.ti_asset_custody_movements (
  id BIGSERIAL PRIMARY KEY,
  asset_id BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE CASCADE,
  from_custody_type TEXT,
  from_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  from_client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
  from_warehouse_code TEXT,
  from_location_label TEXT,
  to_custody_type TEXT NOT NULL,
  to_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  to_client_id INTEGER REFERENCES public.clients(id) ON DELETE SET NULL,
  to_warehouse_code TEXT,
  to_location_label TEXT,
  usage_context TEXT NOT NULL DEFAULT 'internal',
  reason TEXT,
  reference_type TEXT,
  reference_id TEXT,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ti_asset_custody_movements_type_check
    CHECK (to_custody_type IN ('warehouse', 'collaborator', 'client', 'vendor', 'unknown')),
  CONSTRAINT ti_asset_custody_movements_usage_check
    CHECK (usage_context IN ('internal', 'customer_site', 'loan', 'spare', 'demo'))
);

CREATE INDEX IF NOT EXISTS idx_ti_asset_custody_movements_asset_date
  ON public.ti_asset_custody_movements(asset_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ti_asset_custody_movements_client
  ON public.ti_asset_custody_movements(to_client_id) WHERE to_client_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ti_asset_custody_movements_warehouse
  ON public.ti_asset_custody_movements(to_warehouse_code) WHERE to_warehouse_code IS NOT NULL;

INSERT INTO public.ti_asset_custody_movements (
  asset_id, from_custody_type, to_custody_type, to_user_id, to_warehouse_code,
  usage_context, reason, reference_type, created_by, created_at
)
SELECT a.id, NULL, a.custody_type, a.custodian_user_id, a.warehouse_code,
       a.usage_context, 'Backfill inicial de custodia', 'migration_275', a.created_by, a.created_at
  FROM public.ti_assets a
 WHERE NOT EXISTS (
   SELECT 1 FROM public.ti_asset_custody_movements m
    WHERE m.asset_id = a.id AND m.reference_type = 'migration_275'
 );
