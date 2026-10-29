-- Cleanup legacy exclusion keys (cons:<catalog_id>, det:<catalog_id>)
-- and keep canonical keys aligned with bc_consumption_items (cons:<equipment_id>:<catalog_id> / det:...)

BEGIN;

WITH legacy_keys AS (
  SELECT
    e.business_case_id,
    e.item_key,
    split_part(e.item_key, ':', 1) AS prefix,
    split_part(e.item_key, ':', 2) AS catalog_id
  FROM bc_consumption_excluded e
  WHERE e.item_key ~ '^(cons|det):[0-9]+$'
),
canonical_items AS (
  SELECT
    c.business_case_id,
    c.item_key,
    split_part(c.item_key, ':', 1) AS prefix,
    split_part(c.item_key, ':', 3) AS catalog_id
  FROM bc_consumption_items c
  WHERE c.item_key ~ '^(cons|det):[0-9]+:[0-9]+$'
)
DELETE FROM bc_consumption_excluded e
USING legacy_keys l
WHERE e.business_case_id = l.business_case_id
  AND e.item_key = l.item_key
  AND EXISTS (
    SELECT 1
    FROM canonical_items c
    WHERE c.business_case_id = l.business_case_id
      AND c.prefix = l.prefix
      AND c.catalog_id = l.catalog_id
  );

COMMIT;
