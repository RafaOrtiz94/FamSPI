-- Columna de "ultimo actor" por etapa, para el tab Resumen del expediente.
-- No reemplaza los *_by_email existentes por accion especifica -- cubre las
-- etapas que aun no tenian ningun actor guardado (flujo_comercial,
-- disponibilidad/acp, contrato). Tecnica ya tenia columnas de actor
-- (inspection_coordinated_by_email, site_inspection_updated_by_email).

ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS flujo_comercial_last_actor_email TEXT,
  ADD COLUMN IF NOT EXISTS disponibilidad_last_actor_email TEXT,
  ADD COLUMN IF NOT EXISTS contrato_last_actor_email TEXT;

ALTER TABLE equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS disponibilidad_last_actor_email TEXT,
  ADD COLUMN IF NOT EXISTS contrato_last_actor_email TEXT;
