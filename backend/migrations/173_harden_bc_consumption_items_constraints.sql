-- 173_harden_bc_consumption_items_constraints.sql
-- Refuerza la tabla fuente-de-verdad de consumos por Business Case (FK a equipment_purchase_requests)
-- para CRUD consistente de reactivos, calibradores, controles y materiales.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bc_consumption_items'
      AND constraint_name = 'bc_consumption_items_annual_qty_non_negative'
  ) THEN
    ALTER TABLE public.bc_consumption_items
      ADD CONSTRAINT bc_consumption_items_annual_qty_non_negative
      CHECK (annual_qty >= 0);
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'bc_consumption_items'
      AND constraint_name = 'bc_consumption_items_item_type_allowed'
  ) THEN
    ALTER TABLE public.bc_consumption_items
      ADD CONSTRAINT bc_consumption_items_item_type_allowed
      CHECK (item_type IN ('reactivo', 'determinacion', 'control', 'calibrador', 'consumible', 'material'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_bc_consumption_items_bc_type
  ON public.bc_consumption_items (business_case_id, item_type);

