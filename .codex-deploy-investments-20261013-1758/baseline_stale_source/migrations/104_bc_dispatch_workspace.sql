-- 104_bc_dispatch_workspace.sql
-- Objetivo:
-- 1) Persistir la planificacion comercial de cantidades/precios por elemento del BC.
-- 2) Permitir control operativo de despacho por jefe_operaciones.
-- 3) Mantener sincronia con bc_consumption_items para cubrir todos los elementos de la negociacion.

CREATE TABLE IF NOT EXISTS public.bc_dispatch_items (
  id bigserial PRIMARY KEY,
  business_case_id uuid NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  item_id text,
  item_name text NOT NULL,
  item_type text NOT NULL DEFAULT 'otro',
  source text,
  equipment_id integer,
  equipment_name text,
  annual_qty numeric(14,2) NOT NULL DEFAULT 0,
  planned_qty numeric(14,2) NOT NULL DEFAULT 0,
  unit_price numeric(14,4),
  commercial_notes text,
  ops_dispatch_qty numeric(14,2) NOT NULL DEFAULT 0,
  ops_dispatched_qty numeric(14,2) NOT NULL DEFAULT 0,
  ops_status varchar(20) NOT NULL DEFAULT 'pendiente',
  operations_notes text,
  commercial_updated_by_email text,
  operations_updated_by_email text,
  commercial_updated_at timestamptz,
  operations_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (business_case_id, item_key)
);

ALTER TABLE public.bc_dispatch_items
  ADD COLUMN IF NOT EXISTS item_id text,
  ADD COLUMN IF NOT EXISTS item_name text,
  ADD COLUMN IF NOT EXISTS item_type text,
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS equipment_id integer,
  ADD COLUMN IF NOT EXISTS equipment_name text,
  ADD COLUMN IF NOT EXISTS annual_qty numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS planned_qty numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit_price numeric(14,4),
  ADD COLUMN IF NOT EXISTS commercial_notes text,
  ADD COLUMN IF NOT EXISTS ops_dispatch_qty numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ops_dispatched_qty numeric(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ops_status varchar(20) NOT NULL DEFAULT 'pendiente',
  ADD COLUMN IF NOT EXISTS operations_notes text,
  ADD COLUMN IF NOT EXISTS commercial_updated_by_email text,
  ADD COLUMN IF NOT EXISTS operations_updated_by_email text,
  ADD COLUMN IF NOT EXISTS commercial_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS operations_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bc_dispatch_items_type_check'
  ) THEN
    ALTER TABLE public.bc_dispatch_items
      ADD CONSTRAINT bc_dispatch_items_type_check
      CHECK (item_type IN ('reactivo', 'determinacion', 'control', 'calibrador', 'consumible', 'material', 'otro'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bc_dispatch_items_qty_nonnegative_check'
  ) THEN
    ALTER TABLE public.bc_dispatch_items
      ADD CONSTRAINT bc_dispatch_items_qty_nonnegative_check
      CHECK (
        annual_qty >= 0
        AND planned_qty >= 0
        AND ops_dispatch_qty >= 0
        AND ops_dispatched_qty >= 0
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bc_dispatch_items_ops_status_check'
  ) THEN
    ALTER TABLE public.bc_dispatch_items
      ADD CONSTRAINT bc_dispatch_items_ops_status_check
      CHECK (ops_status IN ('pendiente', 'listo', 'parcial', 'despachado', 'cancelado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bc_dispatch_items_bc
  ON public.bc_dispatch_items (business_case_id);

CREATE INDEX IF NOT EXISTS idx_bc_dispatch_items_status
  ON public.bc_dispatch_items (business_case_id, ops_status);

CREATE INDEX IF NOT EXISTS idx_bc_dispatch_items_equipment
  ON public.bc_dispatch_items (business_case_id, equipment_id, item_type);

INSERT INTO public.bc_dispatch_items (
  business_case_id,
  item_key,
  item_id,
  item_name,
  item_type,
  source,
  equipment_id,
  equipment_name,
  annual_qty,
  planned_qty,
  ops_dispatch_qty,
  ops_dispatched_qty,
  ops_status,
  created_at,
  updated_at
)
SELECT
  c.business_case_id,
  c.item_key,
  c.item_id,
  c.name,
  CASE
    WHEN lower(coalesce(c.item_type, '')) IN ('reactivo', 'determinacion', 'control', 'calibrador', 'consumible', 'material')
      THEN lower(c.item_type)
    ELSE 'otro'
  END AS item_type,
  c.source,
  c.equipment_id,
  c.equipment_name,
  GREATEST(coalesce(c.annual_qty, 0), 0)::numeric(14,2) AS annual_qty,
  GREATEST(coalesce(c.annual_qty, 0), 0)::numeric(14,2) AS planned_qty,
  GREATEST(coalesce(c.annual_qty, 0), 0)::numeric(14,2) AS ops_dispatch_qty,
  0::numeric(14,2) AS ops_dispatched_qty,
  'pendiente' AS ops_status,
  now(),
  now()
FROM public.bc_consumption_items c
ON CONFLICT (business_case_id, item_key)
DO UPDATE SET
  item_id = EXCLUDED.item_id,
  item_name = EXCLUDED.item_name,
  item_type = EXCLUDED.item_type,
  source = EXCLUDED.source,
  equipment_id = EXCLUDED.equipment_id,
  equipment_name = EXCLUDED.equipment_name,
  annual_qty = EXCLUDED.annual_qty,
  planned_qty = CASE
    WHEN bc_dispatch_items.commercial_updated_at IS NULL THEN EXCLUDED.annual_qty
    ELSE bc_dispatch_items.planned_qty
  END,
  ops_dispatch_qty = CASE
    WHEN bc_dispatch_items.operations_updated_at IS NULL THEN EXCLUDED.annual_qty
    ELSE bc_dispatch_items.ops_dispatch_qty
  END,
  updated_at = now();
