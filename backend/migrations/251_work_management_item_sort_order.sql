ALTER TABLE work_management.items
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
  SELECT id,
         COALESCE(group_id::text, project_id::text) AS bucket_key,
         ROW_NUMBER() OVER (
           PARTITION BY COALESCE(group_id::text, project_id::text)
           ORDER BY created_at ASC, id ASC
         ) - 1 AS next_sort_order
    FROM work_management.items
)
UPDATE work_management.items i
   SET sort_order = ranked.next_sort_order
  FROM ranked
 WHERE ranked.id = i.id
   AND COALESCE(i.sort_order, 0) = 0;

CREATE INDEX IF NOT EXISTS idx_wm_items_group_sort
  ON work_management.items(group_id, sort_order, created_at);
