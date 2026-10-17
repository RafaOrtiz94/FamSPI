-- Migration: 055_add_primary_key_private_purchase_requests.sql
-- Description: Add PRIMARY KEY constraint to private_purchase_requests table
-- Date: 2026-01-13

-- Add PRIMARY KEY constraint to private_purchase_requests table
ALTER TABLE private_purchase_requests
ADD CONSTRAINT private_purchase_requests_pkey PRIMARY KEY (id);