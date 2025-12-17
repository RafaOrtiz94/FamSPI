-- 019_servicio.sql
-- Tablas base para módulo de Servicio Técnico

-- Esquema
CREATE SCHEMA IF NOT EXISTS servicio;

-- ============================================================
-- Capacitación
-- ============================================================
CREATE TABLE IF NOT EXISTS servicio.cronograma_capacitacion (
  id_capacitacion SERIAL PRIMARY KEY,
  titulo TEXT NOT NULL,
  descripcion TEXT,
  instructor TEXT,
  modalidad TEXT,
  fecha DATE NOT NULL,
  hora_inicio TIME,
  hora_fin TIME,
  ubicacion TEXT,
  estado TEXT DEFAULT 'programada',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Disponibilidad de técnicos
-- ============================================================
CREATE TABLE IF NOT EXISTS servicio.disponibilidad_tecnicos (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT,
  status TEXT DEFAULT 'no_disponible',
  note TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Cronograma de mantenimientos (alineado a 17122025.sql)
CREATE TABLE IF NOT EXISTS servicio.cronograma_mantenimientos (
  id_mantenimiento SERIAL PRIMARY KEY,
  id_equipo INTEGER NOT NULL REFERENCES servicio.equipos(id_equipo) ON DELETE RESTRICT,
  tipo TEXT DEFAULT 'Preventivo',
  descripcion TEXT,
  responsable TEXT,
  fecha_programada DATE NOT NULL,
  fecha_realizacion DATE,
  estado TEXT DEFAULT 'Pendiente',
  observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  carpeta_drive_id TEXT,
  doc_drive_id TEXT,
  link_carpeta TEXT,
  link_doc TEXT,
  request_id INTEGER REFERENCES public.requests(id) ON DELETE SET NULL,
  created_by INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  next_maintenance_date DATE,
  next_maintenance_status TEXT DEFAULT 'pendiente',
  next_maintenance_conflict TEXT,
  next_reminder_sent_at TIMESTAMPTZ,
  firma_responsable TEXT,
  firma_receptor TEXT
);

CREATE INDEX IF NOT EXISTS idx_mantenimientos_equipo ON servicio.cronograma_mantenimientos (id_equipo);
CREATE INDEX IF NOT EXISTS idx_mantenimientos_fecha ON servicio.cronograma_mantenimientos (fecha_programada);
CREATE INDEX IF NOT EXISTS idx_cronograma_mantenimientos_next_status ON servicio.cronograma_mantenimientos (next_maintenance_status);
CREATE INDEX IF NOT EXISTS idx_cronograma_mantenimientos_request_id ON servicio.cronograma_mantenimientos (request_id);

-- ============================================================
-- Cronograma anual de mantenimientos (alineado a 17122025.sql)
CREATE TABLE IF NOT EXISTS servicio.cronograma_mantenimientos_anuales (
  id_mant_anual SERIAL PRIMARY KEY,
  id_equipo INTEGER NOT NULL REFERENCES servicio.equipos(id_equipo) ON DELETE RESTRICT,
  mes TEXT NOT NULL,
  responsable TEXT,
  fecha_programada DATE,
  estado TEXT DEFAULT 'Pendiente',
  comentarios TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mantenimientos_anuales_equipo ON servicio.cronograma_mantenimientos_anuales (id_equipo);

-- ============================================================
-- Triggers de updated_at
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_capacitacion_updated_at'
  ) THEN
    CREATE TRIGGER trg_capacitacion_updated_at
    BEFORE UPDATE ON servicio.cronograma_capacitacion
    FOR EACH ROW EXECUTE PROCEDURE servicio.update_timestamp();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_disponibilidad_updated_at'
  ) THEN
    CREATE TRIGGER trg_disponibilidad_updated_at
    BEFORE UPDATE ON servicio.disponibilidad_tecnicos
    FOR EACH ROW EXECUTE PROCEDURE servicio.update_timestamp();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mantenimientos_updated_at'
  ) THEN
    CREATE TRIGGER trg_mantenimientos_updated_at
    BEFORE UPDATE ON servicio.cronograma_mantenimientos
    FOR EACH ROW EXECUTE PROCEDURE servicio.update_timestamp();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mantenimientos_anuales_updated_at'
  ) THEN
    CREATE TRIGGER trg_mantenimientos_anuales_updated_at
    BEFORE UPDATE ON servicio.cronograma_mantenimientos_anuales
    FOR EACH ROW EXECUTE PROCEDURE servicio.update_timestamp();
  END IF;
END $$;
