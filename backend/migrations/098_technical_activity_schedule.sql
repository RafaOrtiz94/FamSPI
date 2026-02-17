-- 098_technical_activity_schedule.sql
-- Cronograma unificado de actividades del equipo técnico.
-- Sirve para bloquear coordinación de inspecciones en fechas ocupadas.

CREATE SCHEMA IF NOT EXISTS servicio;

CREATE TABLE IF NOT EXISTS servicio.cronograma_actividades_tecnicas (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  activity_date DATE NOT NULL,
  title TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'programado',
  source_type TEXT NOT NULL DEFAULT 'manual',
  source_id TEXT,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  created_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cronograma_actividades_tecnicas_activity_date
  ON servicio.cronograma_actividades_tecnicas (activity_date, status);

CREATE INDEX IF NOT EXISTS idx_cronograma_actividades_tecnicas_user_date
  ON servicio.cronograma_actividades_tecnicas (user_id, activity_date);
