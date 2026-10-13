-- 321_crm_blue_sheet_schema_completion.sql
-- Completa lo que 233_crm_sub_tables_schema_fix.sql dejo fuera: con ambas aplicadas, todas las
-- operaciones del Blue Sheet que usa crm.service.js tienen sus columnas. Solo aditivo (ADD COLUMN
-- IF NOT EXISTS / DROP NOT NULL); no cambia ni borra datos.
--
-- Contexto (verificado contra produccion el 2026-10-12): 233 nunca se aplico y, aun aplicada, estas
-- tres operaciones seguian fallando con 500. Aplicar 233 ANTES que esta.

-- 1. Resultados (Win-Results): el servicio inserta en `description`; la columna original
--    `result_description` era NOT NULL y bloqueaba todo INSERT.
ALTER TABLE crm.crm_win_results
  ALTER COLUMN result_description DROP NOT NULL;

-- 2. Scorecard: saveBlueSheetScorecard guarda `notes` y `scored_by`.
ALTER TABLE crm.crm_scorecard_answers
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS scored_by integer REFERENCES public.users(id);

-- 3. Acciones: completeActionItem guarda `completion_notes`.
ALTER TABLE crm.crm_action_items
  ADD COLUMN IF NOT EXISTS completion_notes text;
