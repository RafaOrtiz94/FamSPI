-- 147_ca01xx_sitrad_integration.sql
-- TASK-CAL-01: Integración SITRAD API para monitoreo automático

-- 1. Logs de SITRAD (monitoreo continuo)
CREATE TABLE IF NOT EXISTS public.ca01xx_sitrad_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.ca0101_devices(id) ON DELETE CASCADE,
  sitrad_device_id TEXT NOT NULL,
  temperature NUMERIC(5,2) NOT NULL,
  humidity NUMERIC(5,2),
  raw_data JSONB,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reading_timestamp TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sitrad_logs_device 
  ON public.ca01xx_sitrad_logs(device_id, reading_timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_sitrad_logs_imported
  ON public.ca01xx_sitrad_logs(imported_at DESC);

-- 2. Sesiones de Mapeo Térmico
CREATE TABLE IF NOT EXISTS public.ca01xx_mapping_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL, -- BODEGA, CAMARA_FRIA, REFRIGERADOR, CONGELADOR
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'in_progress',
  min_temperature NUMERIC(5,2),
  max_temperature NUMERIC(5,2),
  min_humidity NUMERIC(5,2),
  max_humidity NUMERIC(5,2),
  hot_spots JSONB,
  cold_spots JSONB,
  report_url TEXT,
  created_by BIGINT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ca01xx_mapping_sessions_status_check'
  ) THEN
    ALTER TABLE public.ca01xx_mapping_sessions
      ADD CONSTRAINT ca01xx_mapping_sessions_status_check
      CHECK (status IN ('in_progress', 'completed', 'cancelled'));
  END IF;
END $$;

-- 3. Puntos de Mapeo (resultados por ubicación)
CREATE TABLE IF NOT EXISTS public.ca01xx_mapping_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.ca01xx_mapping_sessions(id) ON DELETE CASCADE,
  location_name TEXT NOT NULL,
  coordinates JSONB,
  temperature NUMERIC(5,2) NOT NULL,
  humidity NUMERIC(5,2),
  is_hot_spot BOOLEAN NOT NULL DEFAULT false,
  is_cold_spot BOOLEAN NOT NULL DEFAULT false,
  is_critical BOOLEAN NOT NULL DEFAULT false
);

-- 4. Descargas de Datalogger
CREATE TABLE IF NOT EXISTS public.ca01xx_datalogger_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.ca0101_devices(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  readings_count INTEGER NOT NULL DEFAULT 0,
  excursion_count INTEGER NOT NULL DEFAULT 0,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  imported_by BIGINT NULL,
  report JSONB
);

-- 5. Configuración de Alertas
CREATE TABLE IF NOT EXISTS public.ca01xx_alert_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  area TEXT NOT NULL UNIQUE,
  min_temperature NUMERIC(5,2) NOT NULL,
  max_temperature NUMERIC(5,2) NOT NULL,
  min_humidity NUMERIC(5,2),
  max_humidity NUMERIC(5,2),
  alert_delay_minutes INTEGER NOT NULL DEFAULT 5,
  escalation_minutes INTEGER NOT NULL DEFAULT 30,
  notify_roles JSONB NOT NULL DEFAULT '["jefe_calidad", "responsable_bodega"]',
  notify_emails JSONB,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert default alerts
INSERT INTO public.ca01xx_alert_config (area, min_temperature, max_temperature, min_humidity, max_humidity)
VALUES 
  ('CAMARA_FRIA', 2, 8, 35, 65),
  ('REFRIGERADOR', 2, 8, 35, 65),
  ('CONGELADOR', -25, -15, NULL, NULL),
  ('BODEGA', 15, 30, 30, 70)
ON CONFLICT (area) DO NOTHING;

-- 6. Integración con SITRAD (configuración)
CREATE TABLE IF NOT EXISTS public.ca01xx_sitrad_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sitrad_device_id TEXT NOT NULL UNIQUE,
  local_device_id UUID REFERENCES public.ca0101_devices(id) ON DELETE SET NULL,
  area TEXT NOT NULL,
  polling_interval_seconds INTEGER NOT NULL DEFAULT 300,
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_sync TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);