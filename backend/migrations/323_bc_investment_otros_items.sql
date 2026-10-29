-- Migration 323: varios items bajo "Otros" en inversiones adicionales del BC.
-- Cada item de "Otros" es una fila propia de bc_investment_catalog ligada a su
-- Business Case (parent_catalog_id = fila "Otros", business_case_id = BC).
-- Se crea con is_active = false para que nunca aparezca en el catalogo general
-- ni en la sincronizacion con la plantilla (que solo compara items activos);
-- getCatalogWithSelections la muestra solo en su BC. Asi precios, cotizaciones,
-- historico y reservas TI (todo por catalog_id) funcionan sin cambios.
-- Aditiva y reejecutable. Tambien se asegura en runtime desde investments.service.js.

ALTER TABLE public.bc_investment_catalog
  ADD COLUMN IF NOT EXISTS parent_catalog_id INTEGER REFERENCES public.bc_investment_catalog(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS business_case_id UUID REFERENCES public.equipment_purchase_requests(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by_email TEXT;

CREATE INDEX IF NOT EXISTS idx_bc_investment_catalog_business_case
  ON public.bc_investment_catalog (business_case_id)
  WHERE business_case_id IS NOT NULL;

COMMENT ON COLUMN public.bc_investment_catalog.parent_catalog_id IS 'Item padre ("Otros") cuando la fila es un item propio de un Business Case';
COMMENT ON COLUMN public.bc_investment_catalog.business_case_id IS 'Business Case dueno del item (solo items agregados bajo "Otros")';
