-- 106_private_purchase_offer_kind_transfer_domain.sql
-- Objetivo:
-- 1) Agregar nuevo tipo de oferta privada: alquiler con transferencia de dominio.
-- 2) Mantener compatibilidad de aliases con valores legados.
-- 3) Actualizar constraint de integridad para producción.

UPDATE private_purchase_requests
SET offer_kind = CASE
  WHEN LOWER(TRIM(COALESCE(offer_kind, ''))) = 'prestamo' THEN 'alquiler'
  WHEN LOWER(TRIM(COALESCE(offer_kind, ''))) IN (
    'venta',
    'alquiler',
    'comodato',
    'alquiler_transferencia_dominio',
    'alquiler_con_transferencia_de_dominio'
  )
    THEN REPLACE(LOWER(TRIM(offer_kind)), 'alquiler_con_transferencia_de_dominio', 'alquiler_transferencia_dominio')
  ELSE 'venta'
END;

ALTER TABLE private_purchase_requests
  DROP CONSTRAINT IF EXISTS private_purchase_requests_offer_kind_check;

ALTER TABLE private_purchase_requests
  ADD CONSTRAINT private_purchase_requests_offer_kind_check
  CHECK (offer_kind IN ('venta', 'alquiler', 'comodato', 'alquiler_transferencia_dominio'));

COMMENT ON COLUMN private_purchase_requests.offer_kind
  IS 'Tipo de solicitud privada: venta, alquiler, alquiler con transferencia de dominio o comodato';
