-- Script para PostgreSQL (ejecutable en pgAdmin)
DO $$
DECLARE
  client_requests_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'client_requests'
  ) INTO client_requests_exists;

  IF client_requests_exists THEN
    BEGIN
      ALTER TABLE public.client_requests
        ADD COLUMN data_processing_consent BOOLEAN NOT NULL DEFAULT FALSE;

      COMMENT ON COLUMN public.client_requests.data_processing_consent
        IS 'Aceptación interna del tratamiento de datos';
    EXCEPTION
      WHEN duplicate_column THEN
        RAISE NOTICE 'La columna data_processing_consent ya existe en client_requests, no se realizaron cambios.';
    END;
  ELSE
    RAISE NOTICE 'La tabla public.client_requests no existe. Ejecuta primero el script de creación (V3.sql/V4.sql).';
  END IF;
END $$;
