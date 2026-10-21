-- Migration: FASE 2 - Enhancements for Private Purchase Flow
-- Description: Adds fields for client validation blocking, manager contract approval with corrections, delivery scheduling, and audit trail
-- Date: 2026-01-12

-- ===========================================
-- PART 1: Add new fields to private_purchase_requests
-- ===========================================

-- Add fields for client validation blocking
ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS client_registration_requested_at TIMESTAMPTZ;

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS client_approved_at TIMESTAMPTZ;

-- Add fields for manager contract approval with corrections
ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision TEXT CHECK (manager_contract_decision IN ('approved', 'rejected', 'pending'));

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision_reason TEXT;

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision_at TIMESTAMPTZ;

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS manager_contract_decision_by INTEGER REFERENCES users(id);

-- Add fields for delivery scheduling
ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_dates_json JSONB DEFAULT '{}'::jsonb;

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_start_at TIMESTAMPTZ;

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_end_at TIMESTAMPTZ;

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_notes TEXT;

-- Add fields for contract and delivery act documents
ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS contract_document_id VARCHAR(255);

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS delivery_act_document_id VARCHAR(255);

-- Add fields for comodato integration
ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS business_case_id UUID;

ALTER TABLE private_purchase_requests
ADD COLUMN IF NOT EXISTS comodato_business_case_id UUID;

-- ===========================================
-- PART 2: Create purchase_corrections table
-- ===========================================

CREATE TABLE IF NOT EXISTS purchase_corrections (
  id SERIAL PRIMARY KEY,
  private_purchase_id UUID NOT NULL REFERENCES private_purchase_requests(id) ON DELETE CASCADE,
  created_by_user_id INTEGER NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  correction_details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'submitted', 'resolved', 'rejected'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_corrections_purchase_id ON purchase_corrections(private_purchase_id);
CREATE INDEX IF NOT EXISTS idx_purchase_corrections_created_by ON purchase_corrections(created_by_user_id);
CREATE INDEX IF NOT EXISTS idx_purchase_corrections_status ON purchase_corrections(status);
CREATE INDEX IF NOT EXISTS idx_purchase_corrections_created_at ON purchase_corrections(created_at DESC);

-- ===========================================
-- PART 3: Add new states to enum (if using enum, otherwise handled in app)
-- ===========================================

-- Note: Since status uses USER-DEFINED type, we need to alter the enum
-- This assumes private_purchase_status_enum exists

DO $$
BEGIN
  -- Add new states if they don't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'client_approved') THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'client_approved';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'pending_manager_contract_approval') THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'pending_manager_contract_approval';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'contract_rejected_needs_correction') THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'contract_rejected_needs_correction';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'contract_approved_pending_upload') THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'contract_approved_pending_upload';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'pending_operations_schedule') THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'pending_operations_schedule';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'awaiting_dispatch') THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'awaiting_dispatch';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'private_purchase_status_enum' AND e.enumlabel = 'delivered_pending_signatures') THEN
    ALTER TYPE private_purchase_status_enum ADD VALUE 'delivered_pending_signatures';
  END IF;
END $$;

-- ===========================================
-- PART 4: Update existing records (backward compatibility)
-- ===========================================

-- Set default values for existing records
UPDATE private_purchase_requests
SET
  manager_contract_decision = 'pending',
  delivery_dates_json = '{}'::jsonb
WHERE manager_contract_decision IS NULL;

-- ===========================================
-- PART 5: Comments for documentation
-- ===========================================

COMMENT ON COLUMN private_purchase_requests.client_registration_requested_at IS 'Timestamp when client registration was first requested';
COMMENT ON COLUMN private_purchase_requests.client_approved_at IS 'Timestamp when client registration + LOPDP was approved';
COMMENT ON COLUMN private_purchase_requests.manager_contract_decision IS 'Manager decision on contract: approved/rejected/pending';
COMMENT ON COLUMN private_purchase_requests.manager_contract_decision_reason IS 'Reason for manager decision (especially rejections)';
COMMENT ON COLUMN private_purchase_requests.manager_contract_decision_at IS 'Timestamp of manager decision';
COMMENT ON COLUMN private_purchase_requests.manager_contract_decision_by IS 'User ID who made the manager decision';
COMMENT ON COLUMN private_purchase_requests.delivery_dates_json IS 'Flexible JSON storage for delivery scheduling data';
COMMENT ON COLUMN private_purchase_requests.delivery_start_at IS 'Planned delivery start date';
COMMENT ON COLUMN private_purchase_requests.delivery_end_at IS 'Planned delivery end date';
COMMENT ON COLUMN private_purchase_requests.delivery_notes IS 'Additional notes for delivery scheduling';
COMMENT ON COLUMN private_purchase_requests.contract_document_id IS 'Drive file ID for generated contract document';
COMMENT ON COLUMN private_purchase_requests.delivery_act_document_id IS 'Drive file ID for delivery act document';
COMMENT ON COLUMN private_purchase_requests.business_case_id IS 'Reference to BC created from this purchase (venta privada)';
COMMENT ON COLUMN private_purchase_requests.comodato_business_case_id IS 'Reference to BC created from comodato variant';

COMMENT ON TABLE purchase_corrections IS 'Corrections submitted when manager rejects contract approval - allows re-submission without restarting process';
COMMENT ON COLUMN purchase_corrections.reason IS 'Reason for the correction request';
COMMENT ON COLUMN purchase_corrections.correction_details IS 'JSON details of what was corrected (documents added, changes made)';
COMMENT ON COLUMN purchase_corrections.status IS 'Status of the correction: open/submitted/resolved/rejected';

-- ===========================================
-- PART 6: Migration audit log
-- ===========================================

INSERT INTO migration_audit_log (
  migration_id,
  description,
  applied_at,
  success,
  details
) VALUES (
  '052_fase2_private_purchase_enhancements',
  'Enhanced private purchase flow with client validation blocking, manager approvals with corrections, delivery scheduling, and comodato integration',
  NOW(),
  true,
  jsonb_build_object(
    'new_fields_added', jsonb_build_array(
      'client_registration_requested_at',
      'client_approved_at',
      'manager_contract_decision',
      'manager_contract_decision_reason',
      'manager_contract_decision_at',
      'manager_contract_decision_by',
      'delivery_dates_json',
      'delivery_start_at',
      'delivery_end_at',
      'delivery_notes',
      'contract_document_id',
      'delivery_act_document_id',
      'business_case_id',
      'comodato_business_case_id'
    ),
    'new_table', 'purchase_corrections',
    'new_states_added', jsonb_build_array(
      'client_approved',
      'pending_manager_contract_approval',
      'contract_rejected_needs_correction',
      'contract_approved_pending_upload',
      'pending_operations_schedule',
      'awaiting_dispatch',
      'delivered_pending_signatures'
    ),
    'indexes_created', 3
  )
);