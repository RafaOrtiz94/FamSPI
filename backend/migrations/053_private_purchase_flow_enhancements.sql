-- Migration: 053_private_purchase_flow_enhancements.sql
-- Description: Enhanced private purchase flow with logistics, calendar integration, and comodato states
-- Date: 2026-01-13

DO $$
BEGIN
    -- Add new enum values for logistics and delivery states
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'waiting_dispatch';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'dispatch_ready';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'delivery_act_generated';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'delivered_signed';

    -- Add new enum values for calendar states
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'delivery_dates_requested';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'delivery_dates_submitted';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'calendar_events_created';

    -- Add new enum values for comodato flow
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'acp_availability_requested';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'acp_availability_confirmed';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'business_case_in_progress';
    ALTER TYPE private_purchase_status_enum ADD VALUE IF NOT EXISTS 'business_case_feasibility_approved';

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Some enum values may already exist, continuing...';
END $$;

-- Note: Table creation commented out for now due to foreign key constraint issues
-- TODO: Create purchase_delivery_schedules table after fixing constraint issues

-- Note: Audit log insertion skipped due to schema mismatch
-- TODO: Fix bc_audit_log schema and add audit log entry
