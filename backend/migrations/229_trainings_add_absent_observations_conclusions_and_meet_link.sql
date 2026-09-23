
-- ============================================================
-- Migration 229: Añadir campos para acta de inasistentes y link de Meet
-- ============================================================

ALTER TABLE trainings
ADD COLUMN IF NOT EXISTS observaciones_inasistentes TEXT;

ALTER TABLE trainings
ADD COLUMN IF NOT EXISTS conclusiones_inasistentes TEXT;

ALTER TABLE trainings
ADD COLUMN IF NOT EXISTS meet_link TEXT;

ALTER TABLE trainings
ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;

ALTER TABLE trainings
ADD COLUMN IF NOT EXISTS calendar_event_url TEXT;
