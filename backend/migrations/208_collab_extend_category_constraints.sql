-- Migration: 208_collab_extend_category_constraints.sql
-- Extiende los CHECK constraints de categoría para incluir 'epp', 'suministros' y 'ti'.
-- Idempotente: DROP CONSTRAINT IF EXISTS + ADD CONSTRAINT.

BEGIN;

-- ── collab_item_catalog ───────────────────────────────────────────────────────
ALTER TABLE public.collab_item_catalog
  DROP CONSTRAINT IF EXISTS collab_item_catalog_category_check;

ALTER TABLE public.collab_item_catalog
  ADD CONSTRAINT collab_item_catalog_category_check
  CHECK (category IN ('ropa', 'epp', 'herramienta', 'logistica', 'suministros'));

-- ── collab_delivery_sessions ──────────────────────────────────────────────────
ALTER TABLE public.collab_delivery_sessions
  DROP CONSTRAINT IF EXISTS collab_delivery_sessions_category_check;

ALTER TABLE public.collab_delivery_sessions
  ADD CONSTRAINT collab_delivery_sessions_category_check
  CHECK (category IN ('ropa', 'epp', 'herramienta', 'logistica', 'suministros', 'ti'));

-- ── collab_delivery_actas ─────────────────────────────────────────────────────
ALTER TABLE public.collab_delivery_actas
  DROP CONSTRAINT IF EXISTS collab_delivery_actas_category_check;

ALTER TABLE public.collab_delivery_actas
  ADD CONSTRAINT collab_delivery_actas_category_check
  CHECK (category IN ('ropa', 'epp', 'herramienta', 'logistica', 'suministros', 'ti'));

COMMIT;
