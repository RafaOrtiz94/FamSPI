-- Migration: 054_create_purchase_delivery_schedules.sql
-- Description: Create purchase_delivery_schedules table for calendar integration
-- Date: 2026-01-13

-- Create table for delivery schedules and calendar integration
CREATE TABLE IF NOT EXISTS purchase_delivery_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    private_purchase_request_id UUID NOT NULL,
    delivery_start_at TIMESTAMPTZ,
    delivery_end_at TIMESTAMPTZ,
    calendar_event_ids JSONB DEFAULT '{}'::jsonb, -- Store Google Calendar event IDs per role
    created_by_user_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add foreign key constraints
ALTER TABLE purchase_delivery_schedules
ADD CONSTRAINT fk_purchase_delivery_schedules_request_id
FOREIGN KEY (private_purchase_request_id) REFERENCES private_purchase_requests(id) ON DELETE CASCADE;

ALTER TABLE purchase_delivery_schedules
ADD CONSTRAINT fk_purchase_delivery_schedules_user_id
FOREIGN KEY (created_by_user_id) REFERENCES users(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_purchase_delivery_schedules_request_id ON purchase_delivery_schedules(private_purchase_request_id);
CREATE INDEX IF NOT EXISTS idx_purchase_delivery_schedules_dates ON purchase_delivery_schedules(delivery_start_at, delivery_end_at);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_purchase_delivery_schedules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_delivery_schedules_updated_at_trigger
    BEFORE UPDATE ON purchase_delivery_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_purchase_delivery_schedules_updated_at();