/**
 * Migration: Add consent record document storage
 * ----------------------------------------------
 * Registra el archivo PDF generado al confirmarse el consentimiento.
 */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = 'client_requests'
       AND column_name = 'consent_record_file_id'
  ) THEN
    ALTER TABLE client_requests ADD COLUMN consent_record_file_id VARCHAR(255);
    COMMENT ON COLUMN client_requests.consent_record_file_id IS 'Archivo generado con la declaración de consentimiento';
  END IF;
END $$;
