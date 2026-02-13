/**
 * Migration: 079_remove_legacy_bc_trigger.sql
 * Goal: Remove legacy BC consistency trigger/function referencing bc_spreadsheet_id.
 * This trigger belongs to the old BC flow and breaks updates after removing legacy columns.
 */

-- Drop trigger if present
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trigger_validate_bc_system'
  ) THEN
    DROP TRIGGER IF EXISTS trigger_validate_bc_system ON public.equipment_purchase_requests;
  END IF;
END $$;

-- Drop legacy function if present
DROP FUNCTION IF EXISTS public.validate_bc_system_consistency();

