CREATE TABLE IF NOT EXISTS public.attendance_telework_access_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  request_date DATE NOT NULL,
  code_hash CHAR(64) NOT NULL,
  status TEXT NOT NULL DEFAULT 'ISSUED',
  issued_by_user_id INTEGER NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  consumed_at TIMESTAMPTZ,
  consumed_exception_id INTEGER REFERENCES public.attendance_exceptions(id) ON DELETE SET NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_telework_access_codes_status_ck CHECK (status IN ('ISSUED', 'CONSUMED', 'REVOKED'))
);

CREATE UNIQUE INDEX IF NOT EXISTS attendance_telework_access_codes_active_user_date_uniq
  ON public.attendance_telework_access_codes (user_id, request_date)
  WHERE status = 'ISSUED';

CREATE INDEX IF NOT EXISTS attendance_telework_access_codes_user_date_idx
  ON public.attendance_telework_access_codes (user_id, request_date DESC, id DESC);

COMMENT ON TABLE public.attendance_telework_access_codes IS
  'Codigos temporales, individuales y de un solo uso para iniciar teletrabajo sin solicitud previa.';
