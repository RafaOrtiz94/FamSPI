ALTER TABLE public.attendance_telework_access_codes
  ALTER COLUMN request_date DROP NOT NULL;

ALTER TABLE public.attendance_telework_access_codes
  ADD COLUMN IF NOT EXISTS is_permanent BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.attendance_telework_access_codes
  DROP CONSTRAINT IF EXISTS attendance_telework_access_codes_status_ck;

ALTER TABLE public.attendance_telework_access_codes
  ADD CONSTRAINT attendance_telework_access_codes_status_ck
  CHECK (status IN ('ISSUED', 'CONSUMED', 'ACTIVE', 'REVOKED'));

CREATE UNIQUE INDEX IF NOT EXISTS attendance_telework_access_codes_active_permanent_user_uniq
  ON public.attendance_telework_access_codes (user_id)
  WHERE status = 'ACTIVE' AND is_permanent = TRUE;

COMMENT ON TABLE public.attendance_telework_access_codes IS
  'Codigos de acceso individual y revocable para teletrabajo. Los codigos permanentes autorizan marcar sin solicitud previa.';
