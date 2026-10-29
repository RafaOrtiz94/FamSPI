/**
 * Migration: Add approval letter file reference to client_requests
 * ---------------------------------------------------------------
 * Guarda el ID del PDF generado para el oficio de aprobación.
 */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_name = 'client_requests'
       AND column_name = 'approval_letter_file_id'
  ) THEN
    ALTER TABLE client_requests ADD COLUMN approval_letter_file_id VARCHAR(255);
    COMMENT ON COLUMN client_requests.approval_letter_file_id IS 'ID del documento de oficio de aprobación generado en Drive';
  END IF;
END $$;
