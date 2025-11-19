-- 2025-11-19: Registrar consentimiento interno del tratamiento de datos para nuevos clientes
ALTER TABLE client_requests
  ADD COLUMN data_processing_consent TINYINT(1) NOT NULL DEFAULT 0 AFTER client_type;
