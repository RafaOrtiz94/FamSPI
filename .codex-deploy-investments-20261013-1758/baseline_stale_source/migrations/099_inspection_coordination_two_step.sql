-- 099_inspection_coordination_two_step.sql
-- Coordinación en 2 pasos:
-- 1) Comercial propone fecha
-- 2) Jefe técnico aprueba/rechaza

ALTER TABLE equipment_purchase_requests
  ADD COLUMN IF NOT EXISTS inspection_proposed_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_proposed_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspection_proposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_proposed_by INTEGER,
  ADD COLUMN IF NOT EXISTS inspection_proposed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS inspection_coordination_status TEXT DEFAULT 'pending_proposal',
  ADD COLUMN IF NOT EXISTS inspection_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspection_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_reviewed_by INTEGER,
  ADD COLUMN IF NOT EXISTS inspection_reviewed_by_email TEXT;

ALTER TABLE private_purchase_requests
  ADD COLUMN IF NOT EXISTS inspection_proposed_date DATE,
  ADD COLUMN IF NOT EXISTS inspection_proposed_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspection_proposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_proposed_by INTEGER,
  ADD COLUMN IF NOT EXISTS inspection_proposed_by_email TEXT,
  ADD COLUMN IF NOT EXISTS inspection_coordination_status TEXT DEFAULT 'pending_proposal',
  ADD COLUMN IF NOT EXISTS inspection_review_notes TEXT,
  ADD COLUMN IF NOT EXISTS inspection_reviewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS inspection_reviewed_by INTEGER,
  ADD COLUMN IF NOT EXISTS inspection_reviewed_by_email TEXT;

UPDATE equipment_purchase_requests
SET inspection_coordination_status = CASE
  WHEN inspection_scheduled_date IS NOT NULL THEN 'accepted'
  WHEN inspection_proposed_date IS NOT NULL THEN 'pending_review'
  WHEN inspection_request_id IS NOT NULL THEN 'pending_proposal'
  ELSE COALESCE(inspection_coordination_status, 'pending_proposal')
END
WHERE inspection_coordination_status IS NULL
   OR inspection_coordination_status = '';

UPDATE private_purchase_requests
SET inspection_coordination_status = CASE
  WHEN inspection_scheduled_date IS NOT NULL THEN 'accepted'
  WHEN inspection_proposed_date IS NOT NULL THEN 'pending_review'
  WHEN inspection_request_id IS NOT NULL THEN 'pending_proposal'
  ELSE COALESCE(inspection_coordination_status, 'pending_proposal')
END
WHERE inspection_coordination_status IS NULL
   OR inspection_coordination_status = '';
