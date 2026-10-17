BEGIN;

ALTER TABLE public.collab_item_catalog
  DROP CONSTRAINT IF EXISTS collab_item_catalog_category_check;
ALTER TABLE public.collab_item_catalog
  ADD CONSTRAINT collab_item_catalog_category_check
  CHECK (category = ANY (ARRAY['ropa', 'epp', 'herramienta', 'logistica', 'suministros', 'poliza']));

ALTER TABLE public.collab_delivery_sessions
  DROP CONSTRAINT IF EXISTS collab_delivery_sessions_category_check;
ALTER TABLE public.collab_delivery_sessions
  ADD CONSTRAINT collab_delivery_sessions_category_check
  CHECK (category = ANY (ARRAY['ropa', 'epp', 'herramienta', 'logistica', 'suministros', 'ti', 'poliza']));

ALTER TABLE public.collab_delivery_actas
  DROP CONSTRAINT IF EXISTS collab_delivery_actas_category_check;
ALTER TABLE public.collab_delivery_actas
  ADD CONSTRAINT collab_delivery_actas_category_check
  CHECK (category = ANY (ARRAY['ropa', 'epp', 'herramienta', 'logistica', 'suministros', 'ti', 'poliza']));

COMMIT;
