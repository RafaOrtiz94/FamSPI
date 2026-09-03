-- Migration: 207_collab_catalog_extend_categories.sql
-- Agrega categorías 'epp' y 'suministros' al CHECK constraint de collab_item_catalog.
-- Idempotente: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT.

BEGIN;

ALTER TABLE public.collab_item_catalog
  DROP CONSTRAINT IF EXISTS collab_item_catalog_category_check;

ALTER TABLE public.collab_item_catalog
  ADD CONSTRAINT collab_item_catalog_category_check
  CHECK (category IN ('ropa', 'epp', 'herramienta', 'logistica', 'suministros'));

-- Misma corrección en collab_deliveries si tiene el constraint derivado
ALTER TABLE public.collab_deliveries
  DROP CONSTRAINT IF EXISTS collab_deliveries_category_check;

-- collab_delivery_sessions
ALTER TABLE public.collab_delivery_sessions
  DROP CONSTRAINT IF EXISTS collab_delivery_sessions_category_check;

ALTER TABLE public.collab_delivery_sessions
  ADD CONSTRAINT collab_delivery_sessions_category_check
  CHECK (category IN ('ropa', 'epp', 'herramienta', 'logistica', 'suministros', 'ti'));

COMMIT;
