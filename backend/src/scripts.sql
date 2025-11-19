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
        ADD COLUMN IF NOT EXISTS data_processing_consent BOOLEAN NOT NULL DEFAULT FALSE;

      COMMENT ON COLUMN public.client_requests.data_processing_consent
        IS 'Aceptación interna del tratamiento de datos';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'No se pudo asegurar data_processing_consent: %', SQLERRM;
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
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS consent_capture_method VARCHAR(50) NOT NULL DEFAULT 'email_link';
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS consent_capture_details TEXT;
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS consent_email_token_id VARCHAR(64);
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS lopdp_consent_method VARCHAR(50);
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS lopdp_consent_details TEXT;
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS lopdp_consent_at TIMESTAMP NULL;
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS lopdp_consent_ip VARCHAR(64);
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS lopdp_consent_user_agent TEXT;
      ALTER TABLE public.client_requests
        ADD COLUMN IF NOT EXISTS consent_evidence_file_id VARCHAR(255);

      COMMENT ON COLUMN public.client_requests.consent_capture_method IS 'Método planificado para recolectar el consentimiento';
      COMMENT ON COLUMN public.client_requests.consent_email_token_id IS 'Token OTP verificado previamente para LOPDP';
      COMMENT ON COLUMN public.client_requests.lopdp_consent_method IS 'Método real utilizado para registrar la aceptación';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'No se pudieron agregar las columnas de consentimiento: %', SQLERRM;
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
    BEGIN
      EXECUTE '
        CREATE TABLE IF NOT EXISTS public.client_request_consents (
          id SERIAL PRIMARY KEY,
          client_request_id INT NOT NULL REFERENCES public.client_requests(id) ON DELETE CASCADE,
          event_type VARCHAR(50) NOT NULL,
          method VARCHAR(50) NOT NULL,
          details TEXT,
          evidence_file_id VARCHAR(255),
          actor_email VARCHAR(255),
          actor_role VARCHAR(100),
          actor_name VARCHAR(255),
          ip VARCHAR(64),
          user_agent TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'No se pudo crear client_request_consents: %', SQLERRM;
    END;

    BEGIN
      EXECUTE '
        CREATE TABLE IF NOT EXISTS public.client_request_consent_tokens (
          id VARCHAR(64) PRIMARY KEY,
          client_email VARCHAR(255) NOT NULL,
          client_name VARCHAR(255),
          code_hash VARCHAR(255) NOT NULL,
          code_last_four VARCHAR(4),
          status VARCHAR(50) NOT NULL DEFAULT ''pending'',
          attempts INT NOT NULL DEFAULT 0,
          expires_at TIMESTAMP NOT NULL,
          verified_at TIMESTAMP NULL,
          verified_by_email VARCHAR(255),
          verified_by_user_id INT,
          created_by_email VARCHAR(255),
          created_by_user_id INT,
          used_at TIMESTAMP NULL,
          used_request_id INT NULL REFERENCES public.client_requests(id) ON DELETE SET NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ';
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'No se pudo crear client_request_consent_tokens: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'La tabla public.client_requests no existe. Ejecuta primero el script de creación (V3.sql/V4.sql).';
  END IF;
END $$;
