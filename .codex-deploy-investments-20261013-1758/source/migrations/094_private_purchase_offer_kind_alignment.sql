-- 094_private_purchase_offer_kind_alignment.sql
-- Objetivo:
-- 1) Unificar tipos de oferta del flujo privado: venta, alquiler, comodato.
-- 2) Mantener compatibilidad con legado (prestamo -> alquiler).
-- 3) Endurecer integridad de datos para producción.

UPDATE private_purchase_requests
SET offer_kind = CASE
  WHEN LOWER(TRIM(COALESCE(offer_kind, ''))) = 'prestamo' THEN 'alquiler'
  WHEN LOWER(TRIM(COALESCE(offer_kind, ''))) IN ('venta', 'alquiler', 'comodato')
    THEN LOWER(TRIM(offer_kind))
  ELSE 'venta'
END;

ALTER TABLE private_purchase_requests
  ALTER COLUMN offer_kind SET DEFAULT 'venta',
  ALTER COLUMN offer_kind SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'private_purchase_requests_offer_kind_check'
  ) THEN
    ALTER TABLE private_purchase_requests
      ADD CONSTRAINT private_purchase_requests_offer_kind_check
      CHECK (offer_kind IN ('venta', 'alquiler', 'comodato'));
  END IF;
END $$;

COMMENT ON COLUMN private_purchase_requests.offer_kind
  IS 'Tipo de solicitud privada: venta, alquiler o comodato';
