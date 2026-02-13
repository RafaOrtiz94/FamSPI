/**
 * Ensure bc_equipment_selection has the unique constraint required by ON CONFLICT.
 * This enables upsert on (business_case_id, is_primary).
 */

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'bc_equipment_selection_business_case_id_is_primary_key'
  ) THEN
    ALTER TABLE public.bc_equipment_selection
      ADD CONSTRAINT bc_equipment_selection_business_case_id_is_primary_key
      UNIQUE (business_case_id, is_primary);
  END IF;
END $$;

