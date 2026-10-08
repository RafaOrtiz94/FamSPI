CREATE TABLE IF NOT EXISTS public.attendance_telework_requests (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  city TEXT NOT NULL,
  location TEXT NOT NULL,
  location_accuracy NUMERIC(10, 2),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING',
  reviewed_by_user_id INTEGER REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  review_reason TEXT,
  consumed_at TIMESTAMPTZ,
  consumed_exception_id INTEGER REFERENCES public.attendance_exceptions(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_telework_requests_status_ck
    CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CONSUMED'))
);

CREATE INDEX IF NOT EXISTS attendance_telework_requests_user_date_idx
  ON public.attendance_telework_requests (user_id, request_date DESC, id DESC);

CREATE INDEX IF NOT EXISTS attendance_telework_requests_pending_idx
  ON public.attendance_telework_requests (status, request_date, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_telework_requests_open_user_date_uniq
  ON public.attendance_telework_requests (user_id, request_date)
  WHERE status IN ('PENDING', 'APPROVED');

COMMENT ON TABLE public.attendance_telework_requests IS
  'Solicitudes previas obligatorias para iniciar una jornada de teletrabajo.';
