-- Script para PostgreSQL (ejecutable en pgAdmin)
DO $$
BEGIN
  ALTER TABLE public.client_requests
    ADD COLUMN data_processing_consent BOOLEAN NOT NULL DEFAULT FALSE;

  COMMENT ON COLUMN public.client_requests.data_processing_consent
    IS 'Aceptación interna del tratamiento de datos';
EXCEPTION
  WHEN duplicate_column THEN
    RAISE NOTICE 'La columna data_processing_consent ya existe en client_requests, no se realizaron cambios.';
END $$;
