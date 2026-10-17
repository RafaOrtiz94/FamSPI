-- Historial de fechas tentativas de entrega del proveedor (compras privadas).
-- acp_comercial registra la fecha que le da el proveedor; puede haber varias
-- versiones a lo largo del proceso, por eso se guarda como lista, no un solo campo.
ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS provider_delivery_dates_history JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN private_purchase_requests.provider_delivery_dates_history IS
  'Historial de fechas tentativas de entrega informadas por el proveedor. Array de {date, notes, registered_by, registered_by_email, registered_at}. Editable por acp_comercial y jefe_operaciones; jefe_logistica solo lectura.';
