-- Posiciones enviadas por el Atajo de iPhone mientras una persona tiene una
-- salida operacional activa. Solo se inserta con salida activa (ver
-- attendanceLocationPings.service.js); fuera de ella el endpoint responde sin
-- tocar la base. Las filas se depuran solas pasado el tiempo de retencion.

CREATE TABLE IF NOT EXISTS public.attendance_location_pings (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  exception_id INTEGER NOT NULL REFERENCES public.attendance_exceptions(id) ON DELETE CASCADE,
  latitude NUMERIC(10, 7) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude NUMERIC(10, 7) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_meters NUMERIC(8, 2),
  source TEXT NOT NULL DEFAULT 'ios_shortcut',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attendance_location_pings_exception
  ON public.attendance_location_pings (exception_id, recorded_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_location_pings_recorded_at
  ON public.attendance_location_pings (recorded_at);

COMMENT ON TABLE public.attendance_location_pings IS
  'Ubicaciones periodicas durante una salida operacional activa (Atajo de iOS). Retencion limitada; ver attendanceLocationPings.service.js.';
