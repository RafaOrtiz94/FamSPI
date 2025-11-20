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

  IF NOT client_requests_exists THEN
    BEGIN
      RAISE NOTICE 'La tabla public.client_requests no existe. Creándola con la estructura base V4...';
      EXECUTE '
        CREATE TABLE IF NOT EXISTS public.client_requests (
          id SERIAL PRIMARY KEY,
          created_by VARCHAR(255) NOT NULL,
          status VARCHAR(50) NOT NULL DEFAULT ''pending_consent'',
          rejection_reason TEXT,
          lopdp_token VARCHAR(255) UNIQUE,
          lopdp_consent_status VARCHAR(50) NOT NULL DEFAULT ''pending'',
          consent_capture_method VARCHAR(50) NOT NULL DEFAULT ''email_link'',
          consent_capture_details TEXT,
          consent_recipient_email VARCHAR(255) NOT NULL,
          consent_email_token_id VARCHAR(64),
          lopdp_consent_method VARCHAR(50),
          lopdp_consent_details TEXT,
          lopdp_consent_at TIMESTAMP NULL,
          lopdp_consent_ip VARCHAR(64),
          lopdp_consent_user_agent TEXT,
          client_email VARCHAR(255) NOT NULL,
          client_type VARCHAR(50) NOT NULL,
          data_processing_consent BOOLEAN NOT NULL DEFAULT FALSE,
          legal_person_business_name VARCHAR(255),
          nationality VARCHAR(100),
          natural_person_firstname VARCHAR(255),
          natural_person_lastname VARCHAR(255),
          commercial_name VARCHAR(255),
          establishment_name VARCHAR(255),
          ruc_cedula VARCHAR(20) NOT NULL UNIQUE,
          establishment_province VARCHAR(100),
          establishment_city VARCHAR(100),
          establishment_address TEXT,
          establishment_reference TEXT,
          establishment_phone VARCHAR(50),
          establishment_cellphone VARCHAR(50),
          legal_rep_name VARCHAR(255),
          legal_rep_position VARCHAR(100),
          legal_rep_id_document VARCHAR(20),
          legal_rep_cellphone VARCHAR(50),
          legal_rep_email VARCHAR(255),
          shipping_contact_name VARCHAR(255),
          shipping_address TEXT,
          shipping_city VARCHAR(100),
          shipping_province VARCHAR(100),
          shipping_reference TEXT,
          shipping_phone VARCHAR(50),
          shipping_cellphone VARCHAR(50),
          shipping_delivery_hours VARCHAR(255),
          operating_permit_status VARCHAR(50),
          drive_folder_id VARCHAR(255),
          legal_rep_appointment_file_id VARCHAR(255),
          ruc_file_id VARCHAR(255),
          id_file_id VARCHAR(255),
          operating_permit_file_id VARCHAR(255),
          consent_evidence_file_id VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      ';
      client_requests_exists := TRUE;
    EXCEPTION
      WHEN others THEN
        RAISE NOTICE 'No se pudo crear la tabla client_requests: %', SQLERRM;
    END;
  END IF;

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
        ADD COLUMN IF NOT EXISTS consent_recipient_email VARCHAR(255);
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
      COMMENT ON COLUMN public.client_requests.consent_recipient_email IS 'Correo al que se envió el código OTP LOPDP';
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
    RAISE NOTICE 'No se pudo localizar ni crear la tabla public.client_requests. Revisa V4.sql antes de reintentar.';
  END IF;
END $$;

-- Asegurar columnas de consentimiento interno en usuarios y tabla de auditoría
DO $$
BEGIN
  BEGIN
    ALTER TABLE public.users
      ADD COLUMN IF NOT EXISTS lopdp_internal_status VARCHAR(50) NOT NULL DEFAULT 'granted',
      ADD COLUMN IF NOT EXISTS lopdp_internal_signed_at TIMESTAMP NULL,
      ADD COLUMN IF NOT EXISTS lopdp_internal_pdf_file_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lopdp_internal_signature_file_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS lopdp_internal_ip VARCHAR(64),
      ADD COLUMN IF NOT EXISTS lopdp_internal_user_agent TEXT,
      ADD COLUMN IF NOT EXISTS lopdp_internal_notes TEXT;
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'No se pudieron agregar las columnas internas de LOPDP en users: %', SQLERRM;
  END;

  BEGIN
    EXECUTE '
      CREATE TABLE IF NOT EXISTS public.user_lopdp_consents (
        id SERIAL PRIMARY KEY,
        user_id INT NULL,
        user_email VARCHAR(255) NOT NULL,
        status VARCHAR(50) NOT NULL,
        base_folder_id VARCHAR(255),
        person_folder_id VARCHAR(255),
        signed_folder_id VARCHAR(255),
        pdf_file_id VARCHAR(255),
        signature_file_id VARCHAR(255),
        ip VARCHAR(64),
        user_agent TEXT,
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    ';
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'No se pudo crear user_lopdp_consents: %', SQLERRM;
  END;

  BEGIN
    ALTER TABLE public.user_lopdp_consents
      ADD COLUMN IF NOT EXISTS base_folder_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS person_folder_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS signed_folder_id VARCHAR(255);
  EXCEPTION
    WHEN others THEN
      RAISE NOTICE 'No se pudieron agregar columnas de estructura LOPDP: %', SQLERRM;
  END;
END $$;
