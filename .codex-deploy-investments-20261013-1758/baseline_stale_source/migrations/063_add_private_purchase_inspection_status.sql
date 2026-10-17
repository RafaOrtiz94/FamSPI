DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'private_purchase_status_enum'
      AND e.enumlabel = 'inspection_requested'
  ) THEN
    ALTER TYPE private_purchase_status_enum
      ADD VALUE 'inspection_requested';
  END IF;
END $$;
