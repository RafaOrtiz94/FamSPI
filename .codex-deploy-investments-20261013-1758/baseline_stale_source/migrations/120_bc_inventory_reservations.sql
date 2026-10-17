-- 120_bc_inventory_reservations.sql
-- Reserva de inventario por Business Case al aprobar factibilidad

CREATE TABLE IF NOT EXISTS public.bc_inventory_reservations (
  id BIGSERIAL PRIMARY KEY,
  business_case_id UUID NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  equipment_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  reserved_unit_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  status TEXT NOT NULL DEFAULT 'active',
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reserved_by INTEGER NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT bc_inventory_reservations_quantity_check CHECK (quantity > 0),
  CONSTRAINT bc_inventory_reservations_unique_bc_equipment UNIQUE (business_case_id, equipment_id)
);

ALTER TABLE public.bc_inventory_reservations
  ADD COLUMN IF NOT EXISTS reserved_unit_ids INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN IF NOT EXISTS reserved_by INTEGER NULL,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_bc_inventory_reservations_bc_status
  ON public.bc_inventory_reservations (business_case_id, status);

CREATE INDEX IF NOT EXISTS idx_bc_inventory_reservations_equipment_status
  ON public.bc_inventory_reservations (equipment_id, status);

COMMENT ON TABLE public.bc_inventory_reservations IS 'Reservas de inventario por Business Case en aprobacion de factibilidad';
