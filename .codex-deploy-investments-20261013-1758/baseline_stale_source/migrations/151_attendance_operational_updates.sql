-- Migración: Actualización de asistencia operacional
-- Añade columnas para la marcación real del almuerzo durante operaciones
-- y previene errores al registrar la hora del acta vs la real.

BEGIN;

-- Añadir columnas para la hora real del almuerzo (doble marcación)
ALTER TABLE user_attendance_records
ADD COLUMN IF NOT EXISTS real_lunch_start_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS real_lunch_end_time TIMESTAMPTZ;

-- Actualizar el comentario de la tabla
COMMENT ON COLUMN user_attendance_records.real_lunch_start_time IS 'Hora real de salida al almuerzo (para doble marcación operacional)';
COMMENT ON COLUMN user_attendance_records.real_lunch_end_time IS 'Hora real de retorno del almuerzo (para doble marcación operacional)';

COMMIT;
