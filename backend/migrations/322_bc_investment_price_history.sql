-- Migration 322: historico reutilizable de inversiones adicionales del BC.
--  1. Proveedor y fecha por archivo de cotizacion, y vinculo cuando el archivo se
--     reutiliza desde otro Business Case (misma fila de Drive, otra fila aqui).
--  2. Bitacora de cambios de precio por item (bc_investment_selections solo
--     guarda el ultimo valor; desde ahora cada guardado deja un evento).
-- Aditiva y reejecutable. Tambien se asegura en runtime desde investments.service.js.

ALTER TABLE public.bc_investment_quotation_files
  ADD COLUMN IF NOT EXISTS supplier_name TEXT,
  ADD COLUMN IF NOT EXISTS quotation_date DATE,
  ADD COLUMN IF NOT EXISTS reused_from_file_id BIGINT REFERENCES public.bc_investment_quotation_files(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.bc_investment_quotation_files.supplier_name IS 'Proveedor que emitio la cotizacion';
COMMENT ON COLUMN public.bc_investment_quotation_files.quotation_date IS 'Fecha de emision de la cotizacion';
COMMENT ON COLUMN public.bc_investment_quotation_files.reused_from_file_id IS 'Archivo original cuando la cotizacion se reutilizo desde otro Business Case';

CREATE TABLE IF NOT EXISTS public.bc_investment_price_events (
  id                          BIGSERIAL PRIMARY KEY,
  business_case_id            UUID        NOT NULL REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  catalog_id                  INTEGER     NOT NULL REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
  price_class                 TEXT        NOT NULL CHECK (price_class IN ('operativa', 'financiera')),
  previous_unit_price         NUMERIC(12,2),
  unit_price                  NUMERIC(12,2),
  previous_depreciation       NUMERIC(5,2),
  depreciation_percentage     NUMERIC(5,2),
  quantity                    INTEGER,
  reused_from_business_case_id UUID REFERENCES public.equipment_purchase_requests(id) ON DELETE SET NULL,
  changed_by                  INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  changed_by_email            TEXT,
  changed_by_role             TEXT,
  changed_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bc_investment_price_events_item
  ON public.bc_investment_price_events (business_case_id, catalog_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_bc_investment_price_events_catalog
  ON public.bc_investment_price_events (catalog_id, changed_at DESC);

COMMENT ON TABLE public.bc_investment_price_events IS 'Bitacora de cambios de precio (operativo/financiero) de inversiones adicionales por Business Case';
