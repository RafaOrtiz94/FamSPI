
-- 223: Soporte para asistentes externos en capacitaciones
-- Agrega columnas is_external, permite user_id nulo, y columnas para calendario

ALTER TABLE training_attendees 
  DROP CONSTRAINT IF EXISTS training_attendees_user_id_fkey,
  ALTER COLUMN user_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS is_external BOOLEAN NOT NULL DEFAULT false;

-- Agregamos columnas para el evento de calendario en la tabla trainings
ALTER TABLE trainings
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT,
  ADD COLUMN IF NOT EXISTS calendar_event_link TEXT;
