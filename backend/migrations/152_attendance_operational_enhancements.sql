-- Migración 152: Mejoras al flujo de asistencia operacional en campo
-- Separa hora real de salida vs hora formal del acta (RH-09)
-- Agrega trazabilidad de viajes: origen, destino, tipo de cierre
-- Vincula visitas a clientes con la excepción operacional activa

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- 1. user_attendance_records: hora real de entrada vs hora del acta
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE user_attendance_records
  ADD COLUMN IF NOT EXISTS real_entry_time TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entry_source VARCHAR(30) DEFAULT 'manual';

COMMENT ON COLUMN user_attendance_records.real_entry_time IS 'Hora real en que el colaborador inició movimiento (puede ser anterior a la jornada oficial). La columna entry_time siempre refleja la hora del acta RH-09.';
COMMENT ON COLUMN user_attendance_records.entry_source IS 'Origen del registro de entrada: manual | field_op | unexpected | operational';

-- ──────────────────────────────────────────────────────────────────
-- 2. attendance_exceptions: trazabilidad del viaje
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE attendance_exceptions
  ADD COLUMN IF NOT EXISTS origin_description TEXT,
  ADD COLUMN IF NOT EXISTS destination_description TEXT,
  ADD COLUMN IF NOT EXISTS closure_type VARCHAR(30),
  ADD COLUMN IF NOT EXISTS closure_reason TEXT;

COMMENT ON COLUMN attendance_exceptions.origin_description IS 'Descripción del punto de partida del viaje operacional';
COMMENT ON COLUMN attendance_exceptions.destination_description IS 'Descripción del destino del viaje operacional';
COMMENT ON COLUMN attendance_exceptions.closure_type IS 'Tipo de cierre: in_office | outside_office | auto';
COMMENT ON COLUMN attendance_exceptions.closure_reason IS 'Motivo del cierre cuando es fuera de oficina';

-- ──────────────────────────────────────────────────────────────────
-- 3. client_visit_logs: vínculo con la excepción operacional
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE client_visit_logs
  ADD COLUMN IF NOT EXISTS exception_id INTEGER REFERENCES attendance_exceptions(id) ON DELETE SET NULL;

COMMENT ON COLUMN client_visit_logs.exception_id IS 'Excepción operacional (viaje) a la que pertenece esta visita a cliente';

CREATE INDEX IF NOT EXISTS idx_client_visit_logs_exception_id ON client_visit_logs(exception_id);

-- ──────────────────────────────────────────────────────────────────
-- 4. Índices de soporte
-- ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_uar_entry_source ON user_attendance_records(entry_source);

COMMIT;
