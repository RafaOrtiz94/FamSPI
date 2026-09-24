-- Migration 279: ofertas BC separadas por equipo para integraciones
ALTER TABLE public.bc_offer_versions
  ADD COLUMN IF NOT EXISTS offer_key TEXT NOT NULL DEFAULT 'default',
  ADD COLUMN IF NOT EXISTS offer_label TEXT,
  ADD COLUMN IF NOT EXISTS target_equipment_id BIGINT,
  ADD COLUMN IF NOT EXISTS target_equipment_name TEXT;

UPDATE public.bc_offer_versions
   SET offer_key = 'default'
 WHERE offer_key IS NULL OR btrim(offer_key) = '';

ALTER TABLE public.bc_offer_versions
  DROP CONSTRAINT IF EXISTS bc_offer_versions_business_case_version_uniq;

DROP INDEX IF EXISTS public.bc_offer_versions_business_case_version_uniq;

CREATE UNIQUE INDEX IF NOT EXISTS bc_offer_versions_business_case_offer_version_uniq
  ON public.bc_offer_versions (business_case_id, offer_key, version_number)
  WHERE business_case_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS bc_offer_versions_private_purchase_offer_version_uniq
  ON public.bc_offer_versions (private_purchase_id, offer_key, version_number)
  WHERE private_purchase_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS bc_offer_versions_business_case_offer_status_idx
  ON public.bc_offer_versions (business_case_id, offer_key, status, version_number DESC)
  WHERE business_case_id IS NOT NULL;

COMMENT ON COLUMN public.bc_offer_versions.offer_key IS 'Grupo de versionamiento de la oferta. default para oferta unica; equipment:<id> para integraciones multi-equipo.';
COMMENT ON COLUMN public.bc_offer_versions.target_equipment_id IS 'Equipo especifico cubierto por esta oferta cuando el BC es una integracion multi-equipo.';
