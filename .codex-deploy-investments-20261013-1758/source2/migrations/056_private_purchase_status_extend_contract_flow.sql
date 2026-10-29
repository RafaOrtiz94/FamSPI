DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'client_registration_requested'
  ) THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'client_registration_requested';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'pending_contract_approval'
  ) THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'pending_contract_approval';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'contract_available'
  ) THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'contract_available';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'contract_rejected'
  ) THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'contract_rejected';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'acp_availability_rejected'
  ) THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'acp_availability_rejected';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'business_case_under_review'
  ) THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'business_case_under_review';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'business_case_rejected'
  ) THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'business_case_rejected';
  END IF;
END $$;
