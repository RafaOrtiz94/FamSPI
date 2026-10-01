-- Rastrea el hilo de Gmail (thread + ultimo Message-ID) por solicitud, para que
-- disponibilidad/proforma/reserva/tiempo de llegada se encadenen como respuestas
-- del mismo correo en vez de crear un correo nuevo en cada etapa.

ALTER TABLE equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS provider_email_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_email_last_message_id TEXT;

ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS provider_email_thread_id TEXT,
  ADD COLUMN IF NOT EXISTS provider_email_last_message_id TEXT;
