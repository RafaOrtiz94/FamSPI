-- Migration 280: permitir multiples letras de cambio activas por activo.
-- La factura sigue siendo unica por activo mediante idx_ti_financial_docs_asset_type_factura.
DROP INDEX IF EXISTS public.idx_ti_financial_docs_asset_type;

CREATE UNIQUE INDEX IF NOT EXISTS idx_ti_financial_docs_asset_type_factura
  ON public.ti_asset_financial_docs(asset_id, doc_type)
  WHERE active = true AND doc_type = 'factura';
