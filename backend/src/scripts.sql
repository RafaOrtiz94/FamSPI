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

    BEGIN
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS establishment_name VARCHAR(255);

      COMMENT ON COLUMN public.client_requests.establishment_name
        IS 'Nombre del establecimiento registrado en la solicitud';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'No se pudo agregar establishment_name: %', SQLERRM;
    END;

    BEGIN
      EXECUTE '
        ALTER TABLE public.client_requests
          DROP COLUMN IF EXISTS domicile_province,
          DROP COLUMN IF EXISTS domicile_city,
          DROP COLUMN IF EXISTS domicile_address,
          DROP COLUMN IF EXISTS domicile_phone_cellphone,
          DROP COLUMN IF EXISTS treasury_name,
          DROP COLUMN IF EXISTS treasury_email,
          DROP COLUMN IF EXISTS treasury_conventional_phone,
          DROP COLUMN IF EXISTS treasury_cellphone
      ';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'No se pudieron eliminar las columnas obsoletas: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'La tabla public.client_requests no existe. Ejecuta primero el script de creación (V3.sql/V4.sql).';
  END IF;
END $$;
