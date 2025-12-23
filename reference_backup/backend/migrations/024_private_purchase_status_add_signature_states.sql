--
-- Migration 024: Add signature steps to private purchase status enum
--

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'private_purchase_status_enum'
      AND e.enumlabel = 'pending_manager_signature'
  ) THEN
    ALTER TYPE public.private_purchase_status_enum ADD VALUE 'pending_manager_signature';
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'private_purchase_status_enum'
      AND e.enumlabel = 'pending_client_signature'
  ) THEN
    ALTER TYPE public.private_purchase_status_enum ADD VALUE 'pending_client_signature';
  END IF;
END
$$;
