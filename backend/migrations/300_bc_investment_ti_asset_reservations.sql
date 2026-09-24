-- Reserva de activos TI concretos (por serie) para una linea de inversion adicional
-- de un Business Case. Un activo solo puede tener UNA reserva activa a la vez
-- (indice unico parcial abajo) -- eso es lo que garantiza la exclusividad.
--
-- Ciclo: reservada -> released (BC no factible, o liberacion manual de TI)
--                  -> delivered (se completo la entrega del expediente de compras)
--
-- No se agrega 'reserved' como CHECK constraint en ti_assets.status porque esa
-- columna no tiene CHECK hoy (ver migrations/202_ti_assets_v2.sql) -- la lista de
-- estados permitidos vive en ALLOWED_STATUSES (tiAssets.service.js), se actualiza ahi.

CREATE TABLE IF NOT EXISTS public.bc_investment_ti_asset_reservations (
  id              BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  catalog_id      INTEGER NOT NULL REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
  ti_asset_id     BIGINT NOT NULL REFERENCES public.ti_assets(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'reserved'
                  CHECK (status IN ('reserved', 'released', 'delivered')),
  reserved_by     INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  reserved_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  released_at     TIMESTAMPTZ,
  released_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Exclusividad real: mientras este 'reserved', ningun otro BC puede reservar el mismo activo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_bc_investment_ti_asset_active_reservation
  ON public.bc_investment_ti_asset_reservations (ti_asset_id)
  WHERE status = 'reserved';

CREATE INDEX IF NOT EXISTS idx_bc_investment_ti_asset_reservations_bc
  ON public.bc_investment_ti_asset_reservations (business_case_id, catalog_id);
CREATE INDEX IF NOT EXISTS idx_bc_investment_ti_asset_reservations_asset
  ON public.bc_investment_ti_asset_reservations (ti_asset_id);
