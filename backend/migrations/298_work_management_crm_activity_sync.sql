-- Sincroniza items de Work Management como actividades de CRM-Fam y agrega
-- un campo de origen estructurado para mostrarlo en la UI (badge), en vez de
-- seguir dependiendo de texto libre dentro de description.
-- Todo aditivo/nullable: no requiere backfill de filas existentes.

ALTER TABLE crm.crm_activities
  ADD COLUMN IF NOT EXISTS source_module TEXT;

ALTER TABLE work_management.items
  ADD COLUMN IF NOT EXISTS crm_activity_id UUID;

CREATE INDEX IF NOT EXISTS idx_wm_items_crm_activity_id
  ON work_management.items (crm_activity_id);
