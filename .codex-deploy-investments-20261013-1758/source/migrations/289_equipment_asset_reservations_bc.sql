-- Vincula equipment_asset_reservations a un Business Case (equipment_purchase_requests.id
-- es UUID; source_reference_id es BIGINT y no puede guardarlo) y agrega renovacion
-- limitada (1 mes inicial + hasta 2 renovaciones de 1 mes = tope 3 meses) + liberacion manual.

ALTER TABLE public.equipment_asset_reservations
  ADD COLUMN IF NOT EXISTS business_case_id UUID NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS previous_status TEXT REFERENCES public.equipment_asset_status_catalog(code),
  ADD COLUMN IF NOT EXISTS renewal_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_renewals INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS released_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS released_by BIGINT,
  ADD COLUMN IF NOT EXISTS release_reason TEXT;

-- Garantiza a nivel de BD que un asset no puede tener 2 reservas 'active' a la vez
-- (bloquea la condicion de carrera "otro BC reserva el mismo equipo").
CREATE UNIQUE INDEX IF NOT EXISTS ux_equipment_asset_reservations_active_asset
  ON public.equipment_asset_reservations (asset_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_equipment_asset_reservations_bc
  ON public.equipment_asset_reservations (business_case_id)
  WHERE business_case_id IS NOT NULL;
