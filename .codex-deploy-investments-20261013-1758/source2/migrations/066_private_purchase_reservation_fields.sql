ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS reservation_email_sent_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS reservation_email_file_id character varying(255),
  ADD COLUMN IF NOT EXISTS reservation_calendar_event_id character varying(255),
  ADD COLUMN IF NOT EXISTS reservation_calendar_event_link text;

COMMENT ON COLUMN public.private_purchase_requests.reservation_email_sent_at IS 'Fecha de solicitud de reserva enviada al proveedor';
COMMENT ON COLUMN public.private_purchase_requests.reservation_email_file_id IS 'Archivo de correo de reserva en Drive';
COMMENT ON COLUMN public.private_purchase_requests.reservation_calendar_event_id IS 'Evento de calendario para recordatorio de reserva';
COMMENT ON COLUMN public.private_purchase_requests.reservation_calendar_event_link IS 'Link al evento de calendario de reserva';
