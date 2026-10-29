/**
 * Migration: 073_sync_equipment_categories_from_model.sql
 * Goal: Ensure equipment_models has category/category_type for backup matching in workspace
 *
 * Context:
 * - Equipment selection uses category/category_type to find similar backup equipment.
 * - Most equipment_models rows have NULL category/category_type.
 * - equipos_modelo contains categoria + sku + fabricante for many models.
 *
 * Strategy (idempotent):
 * 1) Match equipment_models to equipos_modelo (by sku, model, or name).
 * 2) Fill missing sku/code/manufacturer/category/category_type.
 * 3) If category exists but category_type missing, normalize category_type = category.
 */

WITH matches AS (
  SELECT
    em.id AS equipment_id,
    em.code,
    em.sku,
    em.name,
    em.model,
    em.manufacturer,
    em.category,
    em.category_type,
    m.sku AS modelo_sku,
    m.fabricante AS modelo_fabricante,
    m.categoria AS modelo_categoria,
    ROW_NUMBER() OVER (
      PARTITION BY em.id
      ORDER BY
        (em.sku IS NOT NULL AND em.sku = m.sku) DESC,
        (em.model IS NOT NULL AND m.modelo IS NOT NULL AND em.model = m.modelo) DESC,
        (em.name IS NOT NULL AND m.nombre IS NOT NULL AND lower(em.name) = lower(m.nombre)) DESC,
        m.id
    ) AS rn,
    ROW_NUMBER() OVER (
      PARTITION BY m.sku
      ORDER BY
        (em.sku IS NOT NULL AND em.sku = m.sku) DESC,
        (em.model IS NOT NULL AND m.modelo IS NOT NULL AND em.model = m.modelo) DESC,
        (em.name IS NOT NULL AND m.nombre IS NOT NULL AND lower(em.name) = lower(m.nombre)) DESC,
        em.id
    ) AS rn_sku
  FROM public.equipment_models em
  LEFT JOIN public.equipos_modelo m
    ON (em.sku IS NOT NULL AND em.sku = m.sku)
    OR (em.model IS NOT NULL AND m.modelo IS NOT NULL AND em.model = m.modelo)
    OR (em.name IS NOT NULL AND m.nombre IS NOT NULL AND lower(em.name) = lower(m.nombre))
)
UPDATE public.equipment_models em
SET
  sku = COALESCE(em.sku, matches.modelo_sku),
  code = CASE
    WHEN em.code IS NULL
      AND matches.modelo_sku IS NOT NULL
      AND matches.rn_sku = 1
      AND NOT EXISTS (
        SELECT 1 FROM public.equipment_models em2
        WHERE em2.code = matches.modelo_sku
          AND em2.id <> em.id
      )
    THEN matches.modelo_sku
    ELSE em.code
  END,
  manufacturer = COALESCE(em.manufacturer, matches.modelo_fabricante),
  category = COALESCE(em.category, matches.modelo_categoria),
  category_type = COALESCE(em.category_type, matches.modelo_categoria),
  updated_at = now()
FROM matches
WHERE em.id = matches.equipment_id
  AND matches.rn = 1
  AND (
    em.code IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM public.equipment_models emx
      WHERE emx.code = em.code
        AND emx.id <> em.id
    )
  )
  AND (
    em.sku IS NULL
    OR em.code IS NULL
    OR em.manufacturer IS NULL
    OR em.category IS NULL
    OR em.category_type IS NULL
    OR em.category = ''
    OR em.category_type = ''
  );

-- Normalize category_type from category when only category is present
UPDATE public.equipment_models
SET category_type = category,
    updated_at = now()
WHERE (category_type IS NULL OR category_type = '')
  AND category IS NOT NULL
  AND category <> '';

/**
 * Validation (optional):
 * SELECT COUNT(*) total,
 *        COUNT(*) FILTER (WHERE category_type IS NULL OR category_type = '') AS missing_category_type
 * FROM equipment_models;
 */
