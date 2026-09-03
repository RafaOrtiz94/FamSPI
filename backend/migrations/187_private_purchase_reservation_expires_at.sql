-- Migración 187: Agregar columna de expiración de reserva a compras privadas
-- La migración 066 agregó reservation_email_sent_at pero omitió reservation_expires_at.
-- La columna homóloga en equipment_purchase_requests ya existe (add_reservation_renewal_fields.sql).

ALTER TABLE public.private_purchase_requests
  ADD COLUMN IF NOT EXISTS reservation_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN public.private_purchase_requests.reservation_expires_at IS
  'Fecha de expiración de la reserva del equipo (15 días desde el envío del email de reserva, renovable)';
