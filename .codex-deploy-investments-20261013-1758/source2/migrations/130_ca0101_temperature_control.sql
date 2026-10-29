-- 130_ca0101_temperature_control.sql
-- Tarea: CA-01-01-T01 - Implementar tablas para Control de Sistemas de Temperatura GXP

-- 1. Dispositivos de Control Térmico
CREATE TABLE IF NOT EXISTS public.ca0101_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  location TEXT NOT NULL,
  calibration_date DATE,
  calibration_due_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  created_by BIGINT NULL
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ca0101_devices_status_check'
  ) THEN
    ALTER TABLE public.ca0101_devices
      ADD CONSTRAINT ca0101_devices_status_check
      CHECK (status IN ('active', 'inactive', 'maintenance', 'retired'));
  END IF;
END $$;

-- 2. Lecturas / Tomas diarias
CREATE TABLE IF NOT EXISTS public.ca0101_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.ca0101_devices(id) ON DELETE CASCADE,
  temperature NUMERIC(5,2),
  humidity NUMERIC(5,2),
  recorded_at TIMESTAMPTZ NOT NULL,
  is_out_of_range BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT NULL
);

-- 3. Alarmas / Eventos (link con CAPA o investigación)
CREATE TABLE IF NOT EXISTS public.ca0101_alarms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reading_id UUID NOT NULL REFERENCES public.ca0101_readings(id) ON DELETE CASCADE,
  alarm_type TEXT NOT NULL, -- e.g. HIGH_TEMP, LOW_TEMP, LOW_HUMIDITY
  status TEXT NOT NULL DEFAULT 'open',
  notes TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ca0101_alarms_status_check'
  ) THEN
    ALTER TABLE public.ca0101_alarms
      ADD CONSTRAINT ca0101_alarms_status_check
      CHECK (status IN ('open', 'acknowledged', 'resolved', 'closed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ca0101_devices_location
  ON public.ca0101_devices (location);

CREATE INDEX IF NOT EXISTS idx_ca0101_readings_device_date
  ON public.ca0101_readings (device_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_ca0101_alarms_status
  ON public.ca0101_alarms (status);

COMMENT ON TABLE public.ca0101_devices IS 'Catálogo de termo-higrómetros y sensores GXP';
COMMENT ON TABLE public.ca0101_readings IS 'Lecturas operativas de medición térmica/humedad';
COMMENT ON TABLE public.ca0101_alarms IS 'Eventos desviados de medición que abren investigación CAPA';
