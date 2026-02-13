/**
 * Migration: 074_insert_missing_equipment_models_from_equipos_modelo.sql
 * Goal: Populate equipment_models with missing entries from equipos_modelo
 *
 * Context:
 * - equipment_models is used by equipment catalog (business case).
 * - equipos_modelo contains additional models not present in equipment_models.
 * - code has UNIQUE constraint; use sku as code only if not already taken.
 */

INSERT INTO public.equipment_models (
  code,
  sku,
  name,
  manufacturer,
  model,
  category,
  category_type,
  status,
  created_at,
  updated_at
)
SELECT
  CASE
    WHEN m.sku IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.equipment_models emc
        WHERE emc.code = m.sku
      )
    THEN m.sku
    ELSE NULL
  END AS code,
  m.sku,
  m.nombre AS name,
  m.fabricante AS manufacturer,
  m.modelo AS model,
  m.categoria AS category,
  m.categoria AS category_type,
  'operativo'::text AS status,
  now(),
  now()
FROM public.equipos_modelo m
LEFT JOIN public.equipment_models em
  ON (em.sku IS NOT NULL AND em.sku = m.sku)
  OR (em.model IS NOT NULL AND m.modelo IS NOT NULL AND em.model = m.modelo)
  OR (em.name IS NOT NULL AND m.nombre IS NOT NULL AND lower(em.name) = lower(m.nombre))
WHERE em.id IS NULL;

/**
 * Validation (optional):
 * SELECT COUNT(*) FROM equipment_models;
 * SELECT COUNT(*) FROM equipos_modelo;
 */
