-- 302_crm_red_flags_element_link.sql
-- CRM-Fam: vincula una red flag a un elemento concreto del Blue Sheet
-- (buying influence, competidor, respuesta de scorecard, action item) para
-- poder marcarla/desmarcarla con un icono en el propio elemento, en vez de
-- solo poder crearla como texto libre desde la pestana de Red Flags.

ALTER TABLE crm.crm_red_flags
  ADD COLUMN IF NOT EXISTS related_entity_type varchar(50),
  ADD COLUMN IF NOT EXISTS related_entity_id uuid;

CREATE INDEX IF NOT EXISTS idx_crm_red_flags_related_entity
  ON crm.crm_red_flags (related_entity_type, related_entity_id)
  WHERE deleted_at IS NULL;
