DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'private_purchase_status_enum'
      AND e.enumlabel = 'delivery_act_draft_ready'
  ) THEN
    ALTER TYPE private_purchase_status_enum
      ADD VALUE 'delivery_act_draft_ready';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'private_purchase_status_enum'
      AND e.enumlabel = 'delivery_act_tech_assigned'
  ) THEN
    ALTER TYPE private_purchase_status_enum
      ADD VALUE 'delivery_act_tech_assigned';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'private_purchase_status_enum'
      AND e.enumlabel = 'delivery_act_logistics_signed'
  ) THEN
    ALTER TYPE private_purchase_status_enum
      ADD VALUE 'delivery_act_logistics_signed';
  END IF;
END $$;
